"""CCPilot -- Session and SessionManager."""

import asyncio
import json
import os
import subprocess
import sys
import threading
import uuid
from pathlib import Path

from ccpilot.utils import find_claude, clean_env, no_window_kwargs
from ccpilot.types import EventType

# ── 단일 세션 ─────────────────────────────────────────────────────────────────

class Session:
    def __init__(self, sid: str, cwd: str, model: str = "", title: str = ""):
        self.id        = sid
        self.cwd       = cwd
        self.model_arg = model
        self.title     = title or f"Task {sid}"
        self.phase     = "backlog"   # backlog | inprogress | done
        self._lock       = threading.Lock()
        self._proc: subprocess.Popen | None = None
        self._publish_fn = None
        self._session_id: str | None = None
        self._is_auto_compacting = False
        self._pending_resume: str = ""   # compact 후 히든 재개 메시지
        self._is_hidden_responded = threading.Event()   # _send_hidden 재시도 취소 플래그
        self.project_id: str | None = None
        self.last_response: str = ""

        self.status = {
            "model":               model or "",
            "project":             Path(cwd).name,
            "git_branch":          self._get_git_branch(cwd),
            "total_input_tokens":  0,
            "total_output_tokens": 0,
            "total_cache_tokens":  0,
            "ctx_tokens":          0,
            "ctx_max":             200000,
            "ctx_pct":             0,
            "cost_usd":            0.0,
            "thinking":            False,
            "waiting_for_reset":   False,
            "reset_time":          "",
        }

    def _extract_reset_time(self, err_text: str) -> str | None:
        import re
        m = re.search(r'reset at\s+(.+?)(?:\.|$)', err_text, re.IGNORECASE)
        if m:
            return m.group(1).strip()
        return None

    def _enter_wait_mode(self, reset_time: str | None):
        self.status["waiting_for_reset"] = True
        self.status["reset_time"] = reset_time or ""
        self.status["thinking"] = False
        if self._publish_fn:
            self._publish_fn(self.id, {"type": EventType.STATUS, "status": self.status})

    @staticmethod
    def _get_git_branch(cwd: str) -> str:
        try:
            r = subprocess.run(
                ["git", "branch", "--show-current"],
                cwd=cwd, capture_output=True, text=True, timeout=2
            )
            return r.stdout.strip()
        except Exception:
            return ""

    def send(self, user_text: str):
        # 대기 모드 자동 해제
        if self.status.get("waiting_for_reset"):
            self.status["waiting_for_reset"] = False
            self.status["reset_time"] = ""
            if self._publish_fn:
                self._publish_fn(self.id, {"type": EventType.STATUS, "status": self.status})
        
        base = find_claude()
        if base is None:
            self._publish_fn(self.id, {"type": EventType.ERROR, "message": "claude를 찾을 수 없습니다."})
            return

        cmd = base + [
            "--dangerously-skip-permissions",
            "--print",
            "--output-format", "stream-json",
            "--verbose",
        ]
        if self.model_arg:
            cmd += ["--model", self.model_arg]
        if self._session_id:
            cmd += ["--resume", self._session_id]

        cmd += [user_text]

        self.status["thinking"] = True
        self._publish_fn(self.id, {"type": EventType.STATUS, "status": self.status})

        try:
            proc = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                env=clean_env(),
                cwd=self.cwd,
                **no_window_kwargs(),
            )
        except Exception as e:
            self._publish_fn(self.id, {"type": EventType.ERROR, "message": str(e)})
            return

        with self._lock:
            self._proc = proc

        text_buf = ""
        try:
            for raw in proc.stdout:
                try:
                    if raw[:2] in (b'\xff\xfe', b'\xfe\xff'):
                        line = raw.decode("utf-16").strip()
                    else:
                        line = raw.decode("utf-8", errors="replace").strip()
                except Exception:
                    line = raw.decode("utf-8", errors="replace").strip()

                if not line:
                    continue
                try:
                    ev = json.loads(line)
                except Exception:
                    continue

                t = ev.get("type", "")

                if t == "system" and ev.get("subtype") == "init":
                    self._session_id = ev.get("session_id")
                    self.status["model"] = ev.get("model", self.status["model"])
                    self._publish_fn(self.id, {"type": EventType.STATUS, "status": self.status})
                    slash_cmds = ev.get("slash_commands", [])
                    if slash_cmds:
                        self._publish_fn(self.id, {"type": EventType.SLASH_COMMANDS, "commands": slash_cmds})

                elif t == "assistant":
                    # assistant 이벤트의 usage로 실시간 토큰 업데이트 (thinking 중에도 표시)
                    msg_usage = (ev.get("message") or {}).get("usage") or {}
                    if msg_usage:
                        inp = msg_usage.get("input_tokens", 0)
                        cc  = msg_usage.get("cache_creation_input_tokens", 0)
                        cr  = msg_usage.get("cache_read_input_tokens", 0)
                        ctx_used = inp + cc + cr
                        if ctx_used > 0:
                            self.status["total_input_tokens"] = inp
                            self.status["total_cache_tokens"] = cc + cr
                            self.status["ctx_tokens"] = ctx_used
                            self.status["ctx_pct"] = min(100, round(ctx_used / self.status["ctx_max"] * 100))
                            self._publish_fn(self.id, {"type": EventType.STATUS, "status": self.status})
                    for block in (ev.get("message") or {}).get("content", []):
                        bt = block.get("type")
                        if bt == "text":
                            chunk = block["text"]
                            text_buf += chunk
                            self._publish_fn(self.id, {"type": EventType.OUTPUT, "data": chunk})
                        elif bt == "thinking":
                            self._publish_fn(self.id, {
                                "type": EventType.THINKING,
                                "data": block.get("thinking", ""),
                            })
                        elif bt == "tool_use":
                            name  = block.get("name", "")
                            inp   = block.get("input") or {}
                            summary = ""
                            for key in ("command","code","query","path","pattern","prompt","description"):
                                v = inp.get(key)
                                if isinstance(v, str) and v:
                                    summary = v
                                    break
                            if not summary:
                                for v in inp.values():
                                    if isinstance(v, str) and v:
                                        summary = v; break
                            self._publish_fn(self.id, {
                                "type": EventType.TOOL_USE,
                                "name": name,
                                "summary": summary,
                            })

                elif t == "result":
                    usage       = ev.get("usage") or {}
                    model_usage = ev.get("modelUsage") or {}
                    if usage:
                        self._update_from_result(usage, model_usage, ev.get("total_cost_usd", 0.0))
                    result_text = ev.get("result", "")
                    if result_text and not text_buf:
                        self._publish_fn(self.id, {"type": EventType.OUTPUT, "data": result_text})
                    # 마지막 응답 저장 (세션 재시작 시 컨텍스트 제공용)
                    if text_buf:
                        self.last_response = text_buf
                    elif result_text:
                        self.last_response = result_text
                    # _send_hidden 재시도 루프에 응답 수신 신호
                    self._is_hidden_responded.set()
                    text_buf = ""
                    self.status["thinking"] = False
                    # auto-compact 완료: 재개 메시지 히든 전송
                    if self._is_auto_compacting:
                        self._is_auto_compacting = False
                        self._publish_fn(self.id, {
                            "type": EventType.SYS_NOTICE,
                            "message": f"컨텍스트 압축 완료 (현재 {self.status['ctx_pct']}%) — 작업 재개 중…",
                        })
                        self._publish_fn(self.id, {"type": EventType.STATUS, "status": self.status})
                        # 히든 재개 메시지 전송 (사용자 채팅에 표시 안 됨)
                        resume_msg = self._pending_resume or "이전 작업을 이어서 계속 진행해주세요."
                        self._pending_resume = ""
                        threading.Thread(target=self._send_hidden, args=(resume_msg,), daemon=True).start()
                        return  # done 이벤트는 재개 응답 후 발행
                    self._publish_fn(self.id, {"type": EventType.STATUS, "status": self.status})
                    self._publish_fn(self.id, {"type": EventType.DONE})

        except Exception:
            pass

        try:
            err = proc.stderr.read().decode(errors="replace").strip()
            if err:
                # context limit 에러 감지 → auto-compact 실행
                _ctx_keywords = ("context", "too long", "token limit", "maximum context", "context window")
                _usage_limit_keywords = (
                    "usage limit reached",
                    "rate limit reached",
                    "rate_limit_error",
                    "would exceed your account",
                    "try again later",
                )
                if not self._is_auto_compacting and any(k in err.lower() for k in _ctx_keywords):
                    self._is_auto_compacting = True
                    self._pending_resume = self.last_response or "이전 작업을 이어서 계속 진행해주세요."
                    self._publish_fn(self.id, {
                        "type": EventType.SYS_NOTICE,
                        "message": f"컨텍스트 한도 도달 → /compact 자동 실행 중…",
                    })
                    threading.Thread(target=self.send, args=("/compact",), daemon=True).start()
                elif any(k in err.lower() for k in _usage_limit_keywords):
                    reset_time = self._extract_reset_time(err)
                    self._publish_fn(self.id, {
                        "type": EventType.USAGE_LIMIT,
                        "message": err,
                        "reset_time": reset_time,
                    })
                    self._enter_wait_mode(reset_time)
                else:
                    self._publish_fn(self.id, {"type": EventType.ERROR, "message": err})
        except Exception:
            pass

        proc.wait()
        self.status["thinking"] = False
        with self._lock:
            if self._proc is proc:
                self._proc = None

    def _update_from_result(self, usage: dict, model_usage: dict, cost: float):
        inp = usage.get("input_tokens", 0)
        out = usage.get("output_tokens", 0)
        cc  = usage.get("cache_creation_input_tokens", 0)
        cr  = usage.get("cache_read_input_tokens", 0)

        self.status["total_input_tokens"] = inp
        self.status["total_cache_tokens"] = cc + cr
        self.status["total_output_tokens"] += out
        self.status["cost_usd"]            += cost

        ctx_used = inp + cc + cr
        ctx_max  = self.status["ctx_max"]
        for _m, mu in model_usage.items():
            ctx_max = mu.get("contextWindow", 0) or ctx_max
            break
        self.status["ctx_max"]    = ctx_max
        self.status["ctx_tokens"] = ctx_used
        self.status["ctx_pct"]    = min(100, round(ctx_used / ctx_max * 100)) if ctx_max > 0 else 0

        # ctx_pct 는 추정치로 표시만 — 자동 compact는 에러 감지 시 실행

    def _send_hidden(self, text: str):
        """사용자 채팅에 표시 없이 Claude에 메시지 전송 (compact 후 재개용).
        응답이 올 때까지 30초 주기로 재시도. 응답 수신 시 자동 취소."""
        self._is_hidden_responded.clear()
        attempt = 0
        while not self._is_hidden_responded.is_set():
            attempt += 1
            self._publish_fn(self.id, {"type": EventType.STATUS, "status": {**self.status, "thinking": True}})
            self.send(text)
            if self._is_hidden_responded.is_set():
                break
            # 응답 없으면 30초 대기 후 재시도
            self._is_hidden_responded.wait(30.0)
            if self._is_hidden_responded.is_set():
                break
            if attempt >= 5:   # 최대 5회(2분30초) 후 중단
                break

    def clear_context(self):
        """Claude context를 초기화 (세션 ID 리셋 -> 다음 메시지에서 새 대화 시작)"""
        self._session_id = None
        self.status["total_input_tokens"]  = 0
        self.status["total_output_tokens"] = 0
        self.status["total_cache_tokens"]  = 0
        self.status["ctx_tokens"]          = 0
        self.status["ctx_pct"]             = 0
        self.status["cost_usd"]            = 0.0

    def send_heartbeat(self, mgr):
        """히든 ping 전송. 응답 받으면 connected 발행. UI에 아무것도 표시 안 함."""
        base = find_claude()
        if base is None:
            mgr.publish(self.id, {"type": EventType.ERROR, "message": "claude를 찾을 수 없습니다."})
            return

        cmd = base + [
            "--dangerously-skip-permissions",
            "--print",
            "--output-format", "stream-json",
            "--verbose",
        ]
        if self.model_arg:
            cmd += ["--model", self.model_arg]
        # heartbeat는 새 대화 시작 (session_id 없음) -- 이후 resume용 session_id 획득
        cmd += ["hi"]

        try:
            proc = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                env=clean_env(),
                cwd=self.cwd,
                **no_window_kwargs(),
            )
        except Exception as e:
            mgr.publish(self.id, {"type": EventType.ERROR, "message": str(e)})
            return

        with self._lock:
            self._proc = proc

        try:
            for raw in proc.stdout:
                try:
                    line = raw.decode("utf-8", errors="replace").strip()
                except Exception:
                    continue
                if not line:
                    continue
                try:
                    ev = json.loads(line)
                except Exception:
                    continue

                t = ev.get("type", "")

                if t == "system" and ev.get("subtype") == "init":
                    # heartbeat는 새 세션 ID를 _session_id에 쓰지 않음
                    # (복원된 claude_sid를 보존해야 resume 가능)
                    new_sid = ev.get("session_id")
                    if not self._session_id:
                        self._session_id = new_sid
                    self.status["model"] = ev.get("model", self.status["model"])
                    slash_cmds = ev.get("slash_commands", [])
                    if slash_cmds:
                        mgr.publish(self.id, {"type": EventType.SLASH_COMMANDS, "commands": slash_cmds})

                elif t == "result":
                    usage       = ev.get("usage") or {}
                    model_usage = ev.get("modelUsage") or {}
                    if usage:
                        self._update_from_result(usage, model_usage, ev.get("total_cost_usd", 0.0))
                    # heartbeat 완료 -> connected 발행 (UI에 응답 내용은 표시 안 함)
                    self.status["thinking"] = False
                    mgr.publish(self.id, {"type": EventType.CONNECTED, "status": self.status})
                    break  # result 받으면 종료

        except Exception:
            pass

        try:
            err = proc.stderr.read().decode(errors="replace").strip()
            if err:
                _usage_limit_keywords = (
                    "usage limit reached",
                    "rate limit reached",
                    "rate_limit_error",
                    "would exceed your account",
                    "try again later",
                )
                if any(k in err.lower() for k in _usage_limit_keywords):
                    reset_time = self._extract_reset_time(err)
                    mgr.publish(self.id, {
                        "type": EventType.USAGE_LIMIT,
                        "message": err,
                        "reset_time": reset_time,
                    })
                    self.status["waiting_for_reset"] = True
                    self.status["reset_time"] = reset_time or ""
                    self.status["thinking"] = False
                    mgr.publish(self.id, {"type": EventType.STATUS, "status": self.status})
        except Exception:
            pass

        proc.wait()
        self.status["thinking"] = False
        with self._lock:
            if self._proc is proc:
                self._proc = None

    def stop(self):
        with self._lock:
            proc = self._proc
        if proc:
            try:
                if sys.platform == "win32":
                    # Windows: 프로세스 트리 전체 종료 (node.js 자식 포함)
                    subprocess.run(
                        ["taskkill", "/F", "/T", "/PID", str(proc.pid)],
                        capture_output=True, timeout=5,
                    )
                else:
                    import signal as _sig, os as _os
                    try:
                        _os.killpg(_os.getpgid(proc.pid), _sig.SIGTERM)
                    except Exception:
                        proc.terminate()
                proc.wait(timeout=3)
            except Exception:
                try:
                    proc.kill()
                except Exception:
                    pass


# ── 세션 매니저 ───────────────────────────────────────────────────────────────

from ccpilot.db import load_sessions, save_sessions

class SessionManager:

    def __init__(self):
        self._sessions: dict[str, Session] = {}
        self._lock = threading.Lock()
        self._subs: dict[str, set[asyncio.Queue]] = {}
        self._loop: asyncio.AbstractEventLoop | None = None

    def set_loop(self, loop):
        self._loop = loop

    # ── 영속화 ────────────────────────────────────────────────────────────────

    def _session_to_dict(self, sess: Session) -> dict:
        return {
            "id":            sess.id,
            "cwd":           sess.cwd,
            "model":         sess.model_arg,
            "title":         sess.title,
            "phase":         sess.phase,
            "project_id":    getattr(sess, "project_id", None),
            "claude_sid":    sess._session_id,   # Claude 내부 세션 ID (resume용)
            "status":        sess.status,
            "last_response": getattr(sess, "last_response", ""),
        }

    def stop_all(self):
        """모든 활성 claude subprocess를 병렬로 종료 (앱 종료 시 호출)."""
        with self._lock:
            sessions = list(self._sessions.values())
        if not sessions:
            return
        threads = []
        for sess in sessions:
            def _stop(s=sess):
                try:
                    s.stop()
                except Exception:
                    pass
            th = threading.Thread(target=_stop, daemon=True)
            th.start()
            threads.append(th)
        for th in threads:
            th.join(timeout=5)

    def save(self):
        """현재 세션 목록을 db에 저장."""
        with self._lock:
            data = [self._session_to_dict(s) for s in self._sessions.values()]
        try:
            save_sessions(data)
        except Exception:
            pass

    def load(self) -> list[dict]:
        """db에서 세션 메타 목록 반환 (Session 객체는 생성하지 않음)."""
        try:
            return load_sessions()
        except Exception:
            pass
        return []

    def restore(self, data: dict) -> Session:
        """저장된 dict로 Session 객체를 복원. Claude 세션 ID도 함께 복원."""
        sid   = data["id"]
        sess  = Session(sid, data.get("cwd") or os.getcwd(),
                        model=data.get("model",""), title=data.get("title",""))
        sess.phase        = data.get("phase", "backlog")
        sess.project_id   = data.get("project_id")
        sess._session_id  = data.get("claude_sid")   # resume용 ID 복원
        sess.last_response = data.get("last_response", "")
        saved_status      = data.get("status") or {}
        sess.status.update({k: v for k, v in saved_status.items()
                            if k in sess.status})
        with self._lock:
            self._sessions[sid] = sess
            self._subs[sid] = set()
        sess._publish_fn = self.publish
        return sess

    # ── CRUD ──────────────────────────────────────────────────────────────────

    def create(self, cwd: str | None = None, model: str = "", title: str = "", phase: str = "backlog") -> Session:
        sid = str(uuid.uuid4())[:8]
        sess = Session(sid, cwd or os.getcwd(), model=model, title=title)
        sess.phase = phase
        with self._lock:
            self._sessions[sid] = sess
            self._subs[sid] = set()
        sess._publish_fn = self.publish
        self.save()
        return sess

    def get(self, sid: str) -> Session | None:
        return self._sessions.get(sid)

    def list_all(self) -> list[dict]:
        with self._lock:
            return [self._session_to_dict(s) for s in self._sessions.values()]

    def list_ids(self) -> list[str]:
        return list(self._sessions.keys())

    def remove(self, sid: str):
        with self._lock:
            self._sessions.pop(sid, None)
            self._subs.pop(sid, None)
        self.save()

    # ── Pub/Sub ───────────────────────────────────────────────────────────────

    def subscribe(self, sid: str) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue()
        with self._lock:
            if sid not in self._subs:
                self._subs[sid] = set()
            self._subs[sid].add(q)
        return q

    def unsubscribe(self, sid: str, q: asyncio.Queue):
        with self._lock:
            if sid in self._subs:
                self._subs[sid].discard(q)

    def publish(self, sid: str, msg: dict):
        if not self._loop:
            return
        msg["session_id"] = sid
        data = json.dumps(msg, ensure_ascii=False)
        with self._lock:
            subs = list(self._subs.get(sid, []))
        for q in subs:
            self._loop.call_soon_threadsafe(q.put_nowait, data)

    # ── 커맨드 ────────────────────────────────────────────────────────────────

    def send(self, sid: str, text: str):
        sess = self.get(sid)
        if sess is None:
            return
        threading.Thread(target=sess.send, args=(text,), daemon=True).start()

    def stop(self, sid: str):
        sess = self.get(sid)
        if sess:
            sess.stop()

    def heartbeat(self, sid: str):
        sess = self.get(sid)
        if sess is None:
            return
        sess.send_heartbeat(self)

    def clear(self, sid: str):
        sess = self.get(sid)
        if sess:
            sess.clear_context()
            self.publish(sid, {"type": EventType.CLEARED})
            self.publish(sid, {"type": EventType.STATUS, "status": sess.status})
            self.save()

    def move_phase(self, sid: str, phase: str):
        sess = self.get(sid)
        if sess:
            sess.phase = phase
            self.publish(sid, {"type": EventType.PHASE, "phase": phase})
            self.save()

    def rename(self, sid: str, title: str):
        sess = self.get(sid)
        if sess:
            sess.title = title
            self.publish(sid, {"type": EventType.RENAMED, "title": title})
            self.save()


MGR = SessionManager()
