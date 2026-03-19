"""CCPilot -- HTTP router (handle function)."""

import asyncio
import json
import os
import re
import subprocess as _sp
from pathlib import Path
from urllib.parse import urlparse, parse_qs, unquote

from ccpilot.utils import (
    serve_static, parse_content_length, parse_multipart,
    resolve_cwd, collect_slash_commands, default_projects_dir,
)
from ccpilot.session import MGR
from ccpilot.projects import PROJ_MGR
from ccpilot.planning import run_planning_claude, write_agents_md
from ccpilot.websocket import ws_handshake, ws_recv, ws_send, ws_handler


# ── HTTP + WS 핸들러 ──────────────────────────────────────────────────────────

async def handle(reader, writer):
    try:
        head = await reader.readuntil(b"\r\n\r\n")
    except Exception:
        writer.close(); return

    hs = head.decode(errors="replace")
    parts = hs.split("\r\n")[0].split()
    if len(parts) < 2: writer.close(); return
    method, path = parts[0], parts[1]

    if "upgrade: websocket" in hs.lower():
        sid = path.split("/")[-1] if path.startswith("/ws/") else None
        if sid and MGR.get(sid):
            await ws_handler(reader, writer, hs, sid)
        else:
            writer.write(b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n")
            await writer.drain(); writer.close()
        return

    if method == "GET" and path == "/":
        result = serve_static("index.html")
        if result:
            data, ct = result
            writer.write(
                b"HTTP/1.1 200 OK\r\nContent-Type: " + ct.encode() + b"\r\n"
                b"Content-Length: " + str(len(data)).encode() + b"\r\n"
                b"Connection: close\r\n\r\n" + data
            )
        else:
            writer.write(b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n")

    elif method == "GET" and path.startswith("/static/"):
        result = serve_static(path[len("/static/"):])
        if result:
            data, ct = result
            writer.write(
                b"HTTP/1.1 200 OK\r\nContent-Type: " + ct.encode() + b"\r\n"
                b"Content-Length: " + str(len(data)).encode() + b"\r\n"
                b"Connection: close\r\n\r\n" + data
            )
        else:
            writer.write(b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n")

    elif method == "GET" and path == "/api/projects":
        body = json.dumps({"projects": PROJ_MGR.list_all()}, ensure_ascii=False).encode()
        writer.write(b"HTTP/1.1 200 OK\r\nContent-Type: application/json; charset=utf-8\r\n"
                     b"Content-Length: " + str(len(body)).encode() + b"\r\nConnection: close\r\n\r\n" + body)

    elif method == "GET" and path.startswith("/api/explorer"):
        # ?dir=경로 로 디렉토리 내용 조회
        qs = parse_qs(urlparse(path).query)
        req_dir = unquote(qs.get("dir", [""])[0]).strip()
        if not req_dir:
            req_dir = str(default_projects_dir())
        try:
            base = Path(req_dir)
            items = []
            if base.is_dir():
                for p in sorted(base.iterdir(), key=lambda x: (not x.is_dir(), x.name.lower())):
                    items.append({
                        "name": p.name,
                        "path": str(p),
                        "is_dir": p.is_dir(),
                        "size": p.stat().st_size if p.is_file() else 0,
                    })
            body = json.dumps({
                "dir": str(base),
                "parent": str(base.parent) if base.parent != base else None,
                "items": items,
            }, ensure_ascii=False).encode()
        except Exception as e:
            body = json.dumps({"error": str(e), "dir": req_dir, "parent": None, "items": []}).encode()
        writer.write(b"HTTP/1.1 200 OK\r\nContent-Type: application/json; charset=utf-8\r\n"
                     b"Content-Length: " + str(len(body)).encode() + b"\r\nConnection: close\r\n\r\n" + body)

    elif method == "POST" and path == "/api/explorer/open":
        # 파일탐색기로 경로 열기 (Windows: explorer /select,<path>)
        try:
            cl = parse_content_length(hs)
            body_raw = await reader.read(cl) if cl else b""
            req = json.loads(body_raw) if body_raw else {}
        except Exception:
            req = {}
        target = req.get("path", "").strip()
        ok = False
        if target:
            try:
                p = Path(target)
                if p.is_file():
                    _sp.Popen(["explorer", f"/select,{p}"])
                else:
                    _sp.Popen(["explorer", str(p)])
                ok = True
            except Exception:
                pass
        body = json.dumps({"ok": ok}).encode()
        writer.write(b"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n"
                     b"Content-Length: " + str(len(body)).encode() + b"\r\nConnection: close\r\n\r\n" + body)

    elif method == "POST" and path == "/api/projects":
        try:
            cl = parse_content_length(hs)
            body_raw = await reader.read(cl) if cl else b""
            req = json.loads(body_raw) if body_raw else {}
        except Exception:
            req = {}
        name = req.get("name", "").strip()
        if not name:
            body = json.dumps({"error": "name 필수"}).encode()
            writer.write(b"HTTP/1.1 400 Bad Request\r\nContent-Type: application/json\r\n"
                         b"Content-Length: " + str(len(body)).encode() + b"\r\nConnection: close\r\n\r\n" + body)
        else:
            p = PROJ_MGR.create(name, req.get("root_cwd", ""))
            body = json.dumps(p, ensure_ascii=False).encode()
            writer.write(b"HTTP/1.1 200 OK\r\nContent-Type: application/json; charset=utf-8\r\n"
                         b"Content-Length: " + str(len(body)).encode() + b"\r\nConnection: close\r\n\r\n" + body)

    elif method == "POST" and path.startswith("/api/projects/") and path.endswith("/rename"):
        pid = path.split("/")[3]
        try:
            cl = parse_content_length(hs)
            body_raw = await reader.read(cl) if cl else b""
            req = json.loads(body_raw) if body_raw else {}
        except Exception:
            req = {}
        ok = PROJ_MGR.rename(pid, req.get("name", ""))
        body = json.dumps({"ok": ok}).encode()
        writer.write(b"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n"
                     b"Content-Length: " + str(len(body)).encode() + b"\r\nConnection: close\r\n\r\n" + body)

    elif method == "DELETE" and path.startswith("/api/projects/"):
        pid = path.split("/")[3]
        PROJ_MGR.remove(pid)
        body = b'{"ok":true}'
        writer.write(b"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n"
                     b"Content-Length: " + str(len(body)).encode() + b"\r\nConnection: close\r\n\r\n" + body)

    elif method == "GET" and path == "/api/sessions":
        # 저장된 세션 목록 반환 (복원용)
        saved = MGR.load()
        body = json.dumps({"sessions": saved}, ensure_ascii=False).encode()
        writer.write(
            b"HTTP/1.1 200 OK\r\nContent-Type: application/json; charset=utf-8\r\n"
            b"Content-Length: " + str(len(body)).encode() + b"\r\nConnection: close\r\n\r\n" + body
        )

    elif method == "POST" and path == "/api/sessions/restore":
        # 저장된 세션 목록을 서버 메모리에 일괄 복원
        try:
            cl = parse_content_length(hs)
            body_raw = await reader.read(cl) if cl else b""
            req = json.loads(body_raw) if body_raw else {}
        except Exception:
            req = {}
        sessions_data = req.get("sessions", [])
        restored = []
        slash_commands = collect_slash_commands(os.getcwd())
        for sd in sessions_data:
            sid = sd.get("id", "")
            if not sid or MGR.get(sid):
                continue  # 이미 존재하면 스킵
            try:
                sess = MGR.restore(sd)
                # 마지막 응답 복원
                sess.last_response = sd.get("last_response", "")
                phase = sess.phase
                last_resp = sess.last_response

                # Done 세션은 resume_context 없음 (WebSocket 연결 안 함)
                resume_context = None
                if phase != "done" and last_resp:
                    # 이전 작업내용 요약을 초기 메시지로 전달
                    title = sess.title or "이전 태스크"
                    resume_context = (
                        f"[세션 재시작] 이전 태스크 '{title}'의 작업을 이어서 진행합니다.\n"
                        f"마지막으로 완료된 작업 요약:\n{last_resp[:800]}\n\n"
                        "위 내용을 바탕으로 이전 작업을 계속 진행해주세요."
                    )

                restored.append({
                    "session_id":     sess.id,
                    "title":          sess.title,
                    "phase":          phase,
                    "model":          sess.model_arg,
                    "cwd":            sess.cwd,
                    "project_id":     sess.project_id,
                    "slash_commands": slash_commands,
                    "last_response":  last_resp,
                    "resume_context": resume_context,
                })
            except Exception:
                pass
        body = json.dumps({"sessions": restored}, ensure_ascii=False).encode()
        writer.write(
            b"HTTP/1.1 200 OK\r\nContent-Type: application/json; charset=utf-8\r\n"
            b"Content-Length: " + str(len(body)).encode() + b"\r\nConnection: close\r\n\r\n" + body
        )

    elif method == "DELETE" and path.startswith("/api/session/"):
        sid = path.split("/")[3] if len(path.split("/")) > 3 else ""
        MGR.remove(sid)
        body = b'{"ok":true}'
        writer.write(
            b"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n"
            b"Content-Length: " + str(len(body)).encode() + b"\r\nConnection: close\r\n\r\n" + body
        )

    elif method == "POST" and path == "/api/session":
        try:
            cl = parse_content_length(hs)
            body_raw = await reader.read(cl) if cl else b""
            req = json.loads(body_raw) if body_raw else {}
        except Exception:
            req = {}
        model = req.get("model", "")
        title = req.get("title", "")
        phase = req.get("phase", "backlog")
        cwd_req = req.get("cwd", "")
        project_id = req.get("project_id") or None
        if cwd_req:
            cwd = resolve_cwd(cwd_req)
        else:
            # 경로 미입력 -> projects/{프로젝트명}/{태스크명}/ 구조로 생성
            safe_title = re.sub(r'[\\/:*?"<>|]', '-', title or "task")
            safe_title = re.sub(r'\s+', '-', safe_title).strip('-')[:40] or "task"
            proj = PROJ_MGR.get(project_id) if project_id else None
            proj_root = (proj or {}).get("root_cwd", "").strip()
            if proj_root:
                # 프로젝트에 root_cwd가 설정돼 있으면 그 안에 태스크 폴더
                cwd = resolve_cwd(proj_root, safe_title)
            elif proj:
                # 프로젝트는 있지만 root_cwd 없음 -> projects/{프로젝트명}/{태스크명}/
                safe_proj = re.sub(r'[\\/:*?"<>|]', '-', proj.get("name", "project"))
                safe_proj = re.sub(r'\s+', '-', safe_proj).strip('-')[:40] or "project"
                cwd = resolve_cwd("", safe_proj + "/" + safe_title)
            else:
                # 프로젝트 없음 -> projects/{태스크명}/
                cwd = resolve_cwd("", safe_title)
        sess = MGR.create(cwd, model=model, title=title, phase=phase)
        sess.project_id = project_id
        MGR.save()
        # 실제 파일시스템에서 slash commands 수집 (built-in + skills + commands/)
        slash_commands = collect_slash_commands(cwd)
        body = json.dumps({
            "session_id": sess.id, "model": model,
            "cwd": cwd,
            "slash_commands": slash_commands,
        }).encode()
        writer.write(
            b"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n"
            b"Content-Length: " + str(len(body)).encode() + b"\r\nConnection: close\r\n\r\n" + body
        )

    elif method == "POST" and path == "/api/plan/text":
        try:
            cl = parse_content_length(hs)
            body_raw = await reader.read(cl) if cl else b""
            req = json.loads(body_raw) if body_raw else {}
        except Exception:
            req = {}
        doc_text = req.get("text", "")
        cwd      = resolve_cwd(req.get("cwd", ""))
        model    = req.get("model", "")
        if not doc_text.strip():
            body = json.dumps({"error": "텍스트가 비어 있습니다."}).encode()
            writer.write(b"HTTP/1.1 400 Bad Request\r\nContent-Type: application/json\r\n"
                         b"Content-Length: " + str(len(body)).encode() + b"\r\nConnection: close\r\n\r\n" + body)
        else:
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(None, run_planning_claude, doc_text, cwd, model)
            body = json.dumps(result, ensure_ascii=False).encode()
            writer.write(b"HTTP/1.1 200 OK\r\nContent-Type: application/json; charset=utf-8\r\n"
                         b"Content-Length: " + str(len(body)).encode() + b"\r\nConnection: close\r\n\r\n" + body)

    elif method == "POST" and path == "/api/plan/file":
        try:
            cl = parse_content_length(hs)
            body_raw = await reader.read(cl) if cl else b""
        except Exception:
            body_raw = b""
        # Content-Type 헤더에서 boundary 추출
        boundary = ""
        for line in hs.split("\r\n"):
            if line.lower().startswith("content-type:") and "boundary=" in line.lower():
                for part in line.split(";"):
                    part = part.strip()
                    if part.lower().startswith("boundary="):
                        boundary = part[9:].strip('"')
        if not boundary:
            body = json.dumps({"error": "multipart boundary 없음"}).encode()
            writer.write(b"HTTP/1.1 400 Bad Request\r\nContent-Type: application/json\r\n"
                         b"Content-Length: " + str(len(body)).encode() + b"\r\nConnection: close\r\n\r\n" + body)
        else:
            fields = parse_multipart(body_raw, boundary)
            file_entry = fields.get("file")
            cwd_entry  = fields.get("cwd")
            model_entry = fields.get("model")
            if not file_entry:
                body = json.dumps({"error": "파일 필드 없음"}).encode()
                writer.write(b"HTTP/1.1 400 Bad Request\r\nContent-Type: application/json\r\n"
                             b"Content-Length: " + str(len(body)).encode() + b"\r\nConnection: close\r\n\r\n" + body)
            else:
                _, file_bytes = file_entry
                doc_text = file_bytes.decode("utf-8", errors="replace")
                cwd   = resolve_cwd(cwd_entry[1].decode(errors="replace").strip() if cwd_entry else "")
                model = (model_entry[1].decode(errors="replace").strip() if model_entry else "")
                loop = asyncio.get_event_loop()
                result = await loop.run_in_executor(None, run_planning_claude, doc_text, cwd, model)
                body = json.dumps(result, ensure_ascii=False).encode()
                writer.write(b"HTTP/1.1 200 OK\r\nContent-Type: application/json; charset=utf-8\r\n"
                             b"Content-Length: " + str(len(body)).encode() + b"\r\nConnection: close\r\n\r\n" + body)

    elif method == "POST" and path == "/api/plan/spawn":
        try:
            cl = parse_content_length(hs)
            body_raw = await reader.read(cl) if cl else b""
            req = json.loads(body_raw) if body_raw else {}
        except Exception:
            req = {}
        agents     = req.get("agents", [])
        raw_root   = req.get("root_cwd", "").strip()
        summary    = req.get("summary", "")
        model      = req.get("model", "")
        project_id = req.get("project_id") or None

        # root_cwd 결정: 명시 경로 > 프로젝트 root_cwd > projects/{프로젝트명}/
        if raw_root:
            root_cwd = resolve_cwd(raw_root)
        else:
            proj = PROJ_MGR.get(project_id) if project_id else None
            proj_root = (proj or {}).get("root_cwd", "").strip()
            if proj_root:
                root_cwd = resolve_cwd(proj_root)
            else:
                # 프로젝트명으로 폴더 슬러그 생성 -> projects/{slug}/
                proj_name = (proj or {}).get("name", "") if proj else ""
                safe = re.sub(r'[\\/:*?"<>|]', '-', proj_name or summary[:30] or "project")
                safe = re.sub(r'\s+', '-', safe).strip('-')[:40] or "project"
                root_cwd = resolve_cwd("", safe)  # projects/{safe}/

        # AGENTS.md 생성
        write_agents_md(root_cwd, summary, agents)
        sessions_created = []
        for ag in agents:
            cwd_suffix = ag.get("cwd_suffix", "")
            ag_cwd = resolve_cwd(root_cwd, cwd_suffix) if cwd_suffix else root_cwd
            ag_model = ag.get("model", model)
            sess = MGR.create(ag_cwd, model=ag_model, title=ag.get("title", ag.get("role", "Agent")), phase=ag.get("phase", "inprogress"))
            sess.project_id = project_id
            MGR.save()
            slash_commands = collect_slash_commands(ag_cwd)
            sessions_created.append({
                "session_id": sess.id,
                "role":       ag.get("role", ""),
                "title":      sess.title,
                "model":      ag_model,
                "cwd":        ag_cwd,
                "init_prompt": ag.get("init_prompt", ""),
                "slash_commands": slash_commands,
            })
        body = json.dumps({"sessions": sessions_created}, ensure_ascii=False).encode()
        writer.write(b"HTTP/1.1 200 OK\r\nContent-Type: application/json; charset=utf-8\r\n"
                     b"Content-Length: " + str(len(body)).encode() + b"\r\nConnection: close\r\n\r\n" + body)

    elif method == "POST" and path.startswith("/api/session/") and path.endswith("/phase"):
        sid = path.split("/")[3]
        try:
            cl = parse_content_length(hs)
            body_raw = await reader.read(cl) if cl else b""
            req = json.loads(body_raw) if body_raw else {}
        except Exception:
            req = {}
        MGR.move_phase(sid, req.get("phase", "backlog"))
        body = b'{"ok":true}'
        writer.write(
            b"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n"
            b"Content-Length: " + str(len(body)).encode() + b"\r\nConnection: close\r\n\r\n" + body
        )

    elif method == "POST" and path.startswith("/api/session/") and path.endswith("/rename"):
        sid = path.split("/")[3]
        try:
            cl = parse_content_length(hs)
            body_raw = await reader.read(cl) if cl else b""
            req = json.loads(body_raw) if body_raw else {}
        except Exception:
            req = {}
        MGR.rename(sid, req.get("title", ""))
        body = b'{"ok":true}'
        writer.write(
            b"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n"
            b"Content-Length: " + str(len(body)).encode() + b"\r\nConnection: close\r\n\r\n" + body
        )

    else:
        writer.write(b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n")

    await writer.drain(); writer.close()
