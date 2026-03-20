#!/usr/bin/env python3
"""CCPilot -- Claude Code WebUI entry point."""

import argparse
import asyncio
import signal
import sys
import threading
import logging
from pathlib import Path

# 콘솔 숨김(frozen) 환경에서 오류를 파일로 저장
if getattr(sys, "frozen", False):
    log_path = Path(sys.executable).parent / "ccpilot.log"
    logging.basicConfig(filename=str(log_path), level=logging.ERROR,
                        format="%(asctime)s %(levelname)s %(message)s")

from ccpilot.routes import handle
from ccpilot.session import MGR

# ── 프로세스 정리 ─────────────────────────────────────────────────────────────

_cleanup_done = False

def _cleanup():
    """모든 claude 자식 프로세스를 병렬로 종료. 중복 실행 방지."""
    global _cleanup_done
    if _cleanup_done:
        return
    _cleanup_done = True
    try:
        MGR.stop_all()   # Session.stop() 병렬 실행 (내부 threading)
        MGR.save()
    except Exception:
        pass

def _signal_handler(signum, frame):
    _cleanup()
    sys.exit(0)

# SIGINT(Ctrl+C), SIGTERM(kill) 모두 처리
signal.signal(signal.SIGINT,  _signal_handler)
signal.signal(signal.SIGTERM, _signal_handler)

# ── 서버 스레드 ───────────────────────────────────────────────────────────────

_server_loop: asyncio.AbstractEventLoop | None = None
_stop_event = threading.Event()

def _start_server(port_holder: list, ready: threading.Event):
    """별도 스레드에서 asyncio 서버 실행."""
    global _server_loop

    async def run():
        port = port_holder[0]
        server = None
        for p in range(port, port + 10):
            try:
                server = await asyncio.start_server(handle, "127.0.0.1", p)
                port_holder[0] = p
                break
            except OSError:
                pass
        if not server:
            ready.set()
            return

        loop = asyncio.get_running_loop()
        global _server_loop
        _server_loop = loop
        MGR.set_loop(loop)
        MGR.load()
        ready.set()  # 서버 준비 완료 신호
        async with server:
            # _stop_event가 세팅되면 루프 종료
            await loop.run_in_executor(None, _stop_event.wait)
            server.close()

    asyncio.run(run())


def _shutdown_server():
    """서버 스레드를 정상 종료시킨다."""
    _stop_event.set()


# ── 진입점 ────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="CCPilot -- Claude Code WebUI")
    parser.add_argument("--port", type=int, default=8080)
    parser.add_argument("--browser", action="store_true", help="webview 대신 브라우저로 열기")
    parser.add_argument("--debug", action="store_true", help="webview DevTools(개발자 도구) 활성화")
    parser.add_argument("--fullscreen", action="store_true", help="전체화면으로 시작")
    args = parser.parse_args()
    if args.debug:
        import logging as _logging
        _logging.basicConfig(level=_logging.DEBUG,
                             format="%(asctime)s %(levelname)s %(message)s")

    port_holder = [args.port]
    ready = threading.Event()

    # daemon=False: 메인 스레드 종료 후에도 서버 스레드가 살아있어야
    # _cleanup()이 안전하게 자식 프로세스를 정리할 수 있음
    t = threading.Thread(target=_start_server, args=(port_holder, ready), daemon=False)
    t.start()
    ready.wait(timeout=10)  # 서버 준비 대기

    url = f"http://localhost:{port_holder[0]}"
    print(f"CCPilot -> {url}")

    if args.browser:
        import webbrowser
        webbrowser.open(url)
        try:
            t.join()
        except KeyboardInterrupt:
            pass
        finally:
            _cleanup()
            _shutdown_server()
        return

    try:
        import webview
        # 아이콘 경로: frozen(exe) 환경은 sys._MEIPASS, 일반 실행은 프로젝트 루트
        _icon_path = str(
            (Path(sys._MEIPASS) if getattr(sys, "frozen", False) else Path(__file__).parent)
            / "public" / "logo.ico"
        )
        window = webview.create_window(
            "CCPilot",
            url,
            width=1280,
            height=800,
            min_size=(900, 600),
            fullscreen=args.fullscreen,
        )
        # private_mode=False: localStorage 영속화 (재시작 후에도 theme/lang 유지)
        webview.start(debug=args.debug, private_mode=False, icon=_icon_path)
    except Exception as e:
        # pywebview 실패 시 브라우저로 fallback
        import traceback
        sys.stderr.write(f"Webview initialization failed:\n{traceback.format_exc()}\n")
        logging.error("pywebview 실패, 브라우저로 fallback: %s", e)
        import webbrowser
        webbrowser.open(url)
        try:
            t.join()
        except KeyboardInterrupt:
            pass
    finally:
        # webview 창 닫힘 or fallback 종료 — 자식 프로세스 정리
        _cleanup()
        _shutdown_server()


if __name__ == "__main__":
    main()
