"""CCPilot -- HTTP router (handle function)."""

import asyncio
import base64 as _b64
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
from ccpilot.http_utils import json_response, error_response
from ccpilot.session import MGR
from ccpilot.projects import PROJ_MGR
from ccpilot.planning import run_planning_claude, write_agents_md
from ccpilot.refactoring import run_refactoring_claude
from ccpilot.enhancement import run_enhancement_claude

# 모드별 실행 함수 매핑
_MODE_FN = {
    'planning':    run_planning_claude,
    'refactoring': run_refactoring_claude,
    'enhancement': run_enhancement_claude,
}
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

    if method == "GET" and path == "/favicon.ico":
        result = serve_static("logo.ico")
        if result:
            data, ct = result
            writer.write(
                b"HTTP/1.1 200 OK\r\nContent-Type: " + ct.encode() + b"\r\n"
                b"Content-Length: " + str(len(data)).encode() + b"\r\n"
                b"Cache-Control: max-age=86400\r\nConnection: close\r\n\r\n" + data
            )
        else:
            writer.write(b"HTTP/1.1 204 No Content\r\nContent-Length: 0\r\n\r\n")
        await writer.drain(); writer.close(); return

    elif method == "GET" and path == "/":
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
        json_response(writer, {"projects": PROJ_MGR.list_all()})

    elif method == "GET" and path.startswith("/api/explorer"):
        qs = parse_qs(urlparse(path).query)
        req_dir = unquote(qs.get("dir", [""])[0]).strip()
        if not req_dir:
            req_dir = str(default_projects_dir())
        try:
            base = Path(req_dir).resolve()
            # 보안: 허용된 루트(Home 또는 프로젝트 루트) 제한 우회 방어
            if not base.is_relative_to(Path.home()) and not base.is_relative_to(default_projects_dir()):
                raise ValueError("접근 권한이 없는 디렉터리입니다.")
            items = []
            if base.is_dir():
                for p in sorted(base.iterdir(), key=lambda x: (not x.is_dir(), x.name.lower())):
                    items.append({
                        "name": p.name,
                        "path": str(p),
                        "is_dir": p.is_dir(),
                        "size": p.stat().st_size if p.is_file() else 0,
                    })
            parent = str(base.parent) if base.parent != base else None
            body = {"dir": str(base), "parent": parent, "items": items}
        except Exception as e:
            body = {"error": str(e), "dir": req_dir, "parent": None, "items": []}
        json_response(writer, body)

    elif method == "GET" and path == "/api/folder-dialog":
        # OS 네이티브 폴더 선택 다이얼로그 (tkinter, 표준 라이브러리)
        # run_in_executor로 별도 스레드에서 실행 → asyncio 이벤트 루프 블로킹 방지
        def _open_dialog():
            try:
                import tkinter as tk
                from tkinter import filedialog
                root = tk.Tk()
                root.withdraw()
                root.attributes("-topmost", True)
                path = filedialog.askdirectory(title="작업 폴더 선택", parent=root)
                root.destroy()
                return path or ""
            except Exception:
                return ""
        loop = asyncio.get_event_loop()
        selected = await loop.run_in_executor(None, _open_dialog)
        json_response(writer, {"path": selected})

    elif method == "POST" and path == "/api/explorer/read":
        # Explorer 파일 내용 읽기 (드래그 앤 드롭 첨부용)
        # as_image=True: 이미지 파일을 base64로 반환
        try:
            cl = parse_content_length(hs)
            body_raw = await reader.read(cl) if cl else b""
            req = json.loads(body_raw) if body_raw else {}
        except Exception:
            req = {}
        target = req.get("path", "").strip()
        as_image = req.get("as_image", False)
        _IMAGE_MIME = {
            ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
            ".gif": "image/gif", ".webp": "image/webp", ".bmp": "image/bmp",
            ".svg": "image/svg+xml",
        }
        try:
            p = Path(target)
            if not p.is_file():
                raise ValueError("파일이 아닙니다")
            if as_image:
                if p.stat().st_size > 5 * 1024 * 1024:  # 이미지 5MB 제한
                    raise ValueError("이미지가 너무 큽니다 (최대 5MB)")
                mime = _IMAGE_MIME.get(p.suffix.lower(), "image/" + p.suffix.lstrip(".").lower())
                b64 = _b64.b64encode(p.read_bytes()).decode()
                body = {"b64": b64, "mime_type": mime}
            else:
                if p.stat().st_size > 1024 * 512:
                    raise ValueError("파일이 너무 큽니다 (최대 512KB)")
                content = p.read_text(encoding="utf-8", errors="replace")
                body = {"content": content}
        except Exception as e:
            body = {"error": str(e)}
        json_response(writer, body)

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
                p = Path(target).resolve()
                if not p.is_relative_to(Path.home()) and not p.is_relative_to(default_projects_dir()):
                    raise ValueError("허용되지 않은 경로입니다.")
                if p.is_file():
                    _sp.Popen(["explorer", f"/select,{p}"])
                else:
                    _sp.Popen(["explorer", str(p)])
                ok = True
            except Exception:
                pass
        json_response(writer, {"ok": ok})

    elif method == "POST" and path == "/api/projects":
        try:
            cl = parse_content_length(hs)
            body_raw = await reader.read(cl) if cl else b""
            req = json.loads(body_raw) if body_raw else {}
        except Exception:
            req = {}
        name = req.get("name", "").strip()
        if not name:
            error_response(writer, "name 필수")
        else:
            p = PROJ_MGR.create(name, req.get("root_cwd", ""))
            json_response(writer, p)

    elif method == "POST" and path.startswith("/api/projects/") and path.split("?")[0].endswith("/rename"):
        clean_path = path.split("?")[0]
        parts = clean_path.split("/")
        pid = parts[3] if len(parts) > 3 else ""
        try:
            cl = parse_content_length(hs)
            body_raw = await reader.read(cl) if cl else b""
            req = json.loads(body_raw) if body_raw else {}
        except Exception:
            req = {}
        ok = PROJ_MGR.rename(pid, req.get("name", ""))
        json_response(writer, {"ok": ok})

    elif method == "DELETE" and path.startswith("/api/projects/"):
        clean_path = path.split("?")[0]
        parts = clean_path.split("/")
        pid = parts[3] if len(parts) > 3 else ""
        PROJ_MGR.remove(pid)
        json_response(writer, {"ok": True})

    elif method == "GET" and path == "/api/sessions":
        saved = MGR.load()
        json_response(writer, {"sessions": saved})

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
        json_response(writer, {"sessions": restored})

    elif method == "DELETE" and path.startswith("/api/session/"):
        clean_path = path.split("?")[0]
        parts = clean_path.split("/")
        sid = parts[3] if len(parts) > 3 else ""
        MGR.remove(sid)
        json_response(writer, {"ok": True})

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
        json_response(writer, {
            "session_id": sess.id, "model": model,
            "cwd": cwd,
            "slash_commands": slash_commands,
        })

    elif method == "POST" and path == "/api/plan/text":
        try:
            cl = parse_content_length(hs)
            if cl > 50 * 1024 * 1024:
                error_response(writer, "Payload too large (max 50MB)")
                await writer.drain(); writer.close(); return
            body_raw = await reader.read(cl) if cl else b""
            req = json.loads(body_raw) if body_raw else {}
        except Exception:
            req = {}
        doc_text = req.get("text", "")
        cwd      = resolve_cwd(req.get("cwd", ""))
        model    = req.get("model", "")
        lang     = req.get("lang", "en")
        mode     = req.get("mode", "planning")
        design_files_raw = req.get("design_files", [])
        images = []
        for df in design_files_raw:
            try:
                if "data" not in df:
                    continue
                raw = _b64.b64decode(df["data"])
                if df.get("isImage"):
                    images.append((raw, df.get("mimeType", "image/png")))
                else:
                    doc_text += "\n\n--- Design File: " + df.get("name", "") + " ---\n" + raw.decode("utf-8", errors="replace")
            except Exception as e:
                import logging
                logging.error(f"Design File {df.get('name')} parsing error: {e}")
        
        if not doc_text.strip():
            error_response(writer, "텍스트가 비어 있습니다.")
            await writer.drain(); writer.close(); return
        loop = asyncio.get_event_loop()
        run_fn = _MODE_FN.get(mode, run_planning_claude)
        result = await loop.run_in_executor(
            None, run_fn, doc_text, cwd, model, lang, images or None
        )
        json_response(writer, result)

    elif method == "POST" and path == "/api/plan/file":
        try:
            cl = parse_content_length(hs)
            if cl > 10 * 1024 * 1024:
                error_response(writer, "Payload too large (max 10MB)")
                await writer.drain(); writer.close(); return
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
            error_response(writer, "multipart boundary 없음")
            await writer.drain(); writer.close(); return
        fields = parse_multipart(body_raw, boundary)
        file_entry = fields.get("file")
        cwd_entry  = fields.get("cwd")
        model_entry = fields.get("model")
        if not file_entry:
            error_response(writer, "파일 필드 없음")
            await writer.drain(); writer.close(); return
        _, file_bytes = file_entry
        doc_text = file_bytes.decode("utf-8", errors="replace")
        cwd   = resolve_cwd(cwd_entry[1].decode(errors="replace").strip() if cwd_entry else "")
        model = (model_entry[1].decode(errors="replace").strip() if model_entry else "")
        lang_entry = fields.get("lang")
        lang = (lang_entry[1].decode(errors="replace").strip() if lang_entry else "en")
        mode_entry = fields.get("mode")
        mode = (mode_entry[1].decode(errors="replace").strip() if mode_entry else "planning")
        loop = asyncio.get_event_loop()
        run_fn = _MODE_FN.get(mode, run_planning_claude)
        result = await loop.run_in_executor(None, run_fn, doc_text, cwd, model, lang, None)
        json_response(writer, result)

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
        lang       = req.get("lang", "en")
        design_files_raw = req.get("design_files", [])

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

        # 디자인 파일 저장 (design/ 폴더)
        design_refs = []
        if design_files_raw and root_cwd:
            design_dir = Path(root_cwd) / "design"
            design_dir.mkdir(parents=True, exist_ok=True)
            for df in design_files_raw:
                try:
                    safe_name = re.sub(r'[\\/:*?"<>|]', '_', df.get("name", "design"))
                    fpath = design_dir / safe_name
                    fpath.write_bytes(_b64.b64decode(df["data"]))
                    design_refs.append(str(fpath))
                except Exception as e:
                    import logging
                    logging.error(f"Failed to decode design file {df.get('name')}: {e}")

        if design_refs:
            if lang == 'ko':
                note = ("\n\n**디자인 참조 파일 (Read 툴로 직접 읽을 수 있음):**\n" +
                        "\n".join(f"- `{p}`" for p in design_refs))
            else:
                note = ("\n\n**Design reference files (readable via Read tool):**\n" +
                        "\n".join(f"- `{p}`" for p in design_refs))
            for ag in agents:
                ag["init_prompt"] = ag.get("init_prompt", "") + note

        # AGENTS.md 생성
        write_agents_md(root_cwd, summary, agents, lang=lang)
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
        json_response(writer, {"sessions": sessions_created})

    elif method == "POST" and path.startswith("/api/session/") and path.split("?")[0].endswith("/phase"):
        sid = path.split("?")[0].split("/")[3]
        try:
            cl = parse_content_length(hs)
            body_raw = await reader.read(cl) if cl else b""
            req = json.loads(body_raw) if body_raw else {}
        except Exception:
            req = {}
        MGR.move_phase(sid, req.get("phase", "backlog"))
        json_response(writer, {"ok": True})

    elif method == "POST" and path.startswith("/api/session/") and path.split("?")[0].endswith("/rename"):
        sid = path.split("?")[0].split("/")[3]
        try:
            cl = parse_content_length(hs)
            body_raw = await reader.read(cl) if cl else b""
            req = json.loads(body_raw) if body_raw else {}
        except Exception:
            req = {}
        MGR.rename(sid, req.get("title", ""))
        json_response(writer, {"ok": True})

    elif method == "POST" and path.startswith("/api/session/") and path.split("?")[0].endswith("/model"):
        sid = path.split("?")[0].split("/")[3]
        try:
            cl = parse_content_length(hs)
            body_raw = await reader.read(cl) if cl else b""
            req = json.loads(body_raw) if body_raw else {}
        except Exception:
            req = {}
        new_model = req.get("model", "").strip()
        sess = MGR.get(sid)
        if sess and new_model:
            sess.model_arg = new_model
            sess.status["model"] = new_model
            MGR.save()
            MGR.publish(sid, {"type": "status", "status": sess.status})
            json_response(writer, {"ok": True, "model": new_model})
        else:
            error_response(writer, "session not found or model empty")

    else:
        writer.write(b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n")

    await writer.drain(); writer.close()
