#!/usr/bin/env python3
"""CCPilot -- Claude Code WebUI entry point."""

import argparse
import asyncio
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


def _start_server(port_holder: list, ready: threading.Event):
    """별도 스레드에서 asyncio 서버 실행."""
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
        MGR.set_loop(loop)
        MGR.load()
        ready.set()  # 서버 준비 완료 신호
        async with server:
            await server.serve_forever()

    asyncio.run(run())


def main():
    parser = argparse.ArgumentParser(description="CCPilot -- Claude Code WebUI")
    parser.add_argument("--port", type=int, default=8080)
    parser.add_argument("--browser", action="store_true", help="webview 대신 브라우저로 열기")
    args = parser.parse_args()

    port_holder = [args.port]
    ready = threading.Event()

    t = threading.Thread(target=_start_server, args=(port_holder, ready), daemon=True)
    t.start()
    ready.wait(timeout=10)  # 서버 준비 대기

    url = f"http://localhost:{port_holder[0]}"
    print(f"CCPilot -> {url}")

    if args.browser:
        import webbrowser
        webbrowser.open(url)
        t.join()
        return

    try:
        import webview
        window = webview.create_window(
            "CCPilot",
            url,
            width=1280,
            height=800,
            min_size=(900, 600),
        )
        webview.start()
    except Exception as e:
        # pywebview 실패 시 브라우저로 fallback
        logging.error("pywebview 실패, 브라우저로 fallback: %s", e)
        import webbrowser
        webbrowser.open(url)
        t.join()


if __name__ == "__main__":
    main()
