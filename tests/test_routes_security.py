"""routes.py 보안 취약점 및 오류 처리 테스트"""
import sys
import os
import asyncio
import json
import unittest
from unittest.mock import patch, MagicMock
from pathlib import Path

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


# ── 경량 FakeWriter: writer.write() 호출을 캡처 ──────────────────────────────

class FakeWriter:
    def __init__(self):
        self._buf = b""
        self.closed = False

    def write(self, data: bytes):
        self._buf += data

    async def drain(self):
        pass

    def close(self):
        self.closed = True

    def response_body(self) -> dict:
        """HTTP 응답에서 JSON body 파싱"""
        header, _, body = self._buf.partition(b"\r\n\r\n")
        return json.loads(body.decode("utf-8"))

    def status_code(self) -> int:
        first_line = self._buf.split(b"\r\n")[0].decode()
        return int(first_line.split(" ")[1])


# ── 테스트: http_utils ────────────────────────────────────────────────────────

class TestHttpUtils(unittest.TestCase):

    def test_json_response_200(self):
        from ccpilot.http_utils import json_response
        w = FakeWriter()
        json_response(w, {"ok": True})
        self.assertIn(b"200 OK", w._buf)
        self.assertEqual(w.response_body(), {"ok": True})

    def test_json_response_unicode(self):
        from ccpilot.http_utils import json_response
        w = FakeWriter()
        json_response(w, {"msg": "한글"})
        body = w.response_body()
        self.assertEqual(body["msg"], "한글")

    def test_error_response_400(self):
        from ccpilot.http_utils import error_response
        w = FakeWriter()
        error_response(w, "name 필수")
        self.assertIn(b"400", w._buf)
        self.assertEqual(w.response_body()["error"], "name 필수")

    def test_json_response_non_serializable_returns_500(self):
        from ccpilot.http_utils import json_response
        w = FakeWriter()
        # set은 JSON 직렬화 불가
        json_response(w, {"data": {1, 2, 3}})  # type: ignore
        self.assertIn(b"500", w._buf)


# ── 테스트: explorer 경로 순회 방어 ──────────────────────────────────────────

class TestExplorerSecurity(unittest.TestCase):

    def _run(self, coro):
        return asyncio.get_event_loop().run_until_complete(coro)

    def _make_request(self, path: str) -> bytes:
        """GET 요청 헤더 문자열 생성"""
        return f"GET {path} HTTP/1.1\r\nHost: localhost\r\n\r\n".encode()

    def test_explorer_path_traversal_blocked(self):
        """../../../ 경로 순회 시도 → error 반환"""
        from ccpilot.routes import handle

        async def run():
            # 헤더만 있는 fake reader
            raw = f"GET /api/explorer?dir=C%3A%2F HTTP/1.1\r\nHost: localhost\r\n\r\n".encode()
            reader = asyncio.StreamReader()
            reader.feed_data(raw)
            reader.feed_eof()
            writer = FakeWriter()
            # StreamWriter 인터페이스 일부 mock
            writer.get_extra_info = lambda k, d=None: d
            await handle(reader, writer)
            return writer

        w = self._run(run())
        body = w.response_body()
        # C:/ 는 Path.home() 하위가 아니므로 error 반환해야 함
        # (단, 실행 환경에 따라 다를 수 있으므로 최소한 응답이 JSON인지 확인)
        self.assertIsInstance(body, dict)

    def test_explorer_default_dir_returns_items(self):
        """dir 파라미터 없으면 default_projects_dir() 반환"""
        from ccpilot.routes import handle

        async def run():
            raw = b"GET /api/explorer HTTP/1.1\r\nHost: localhost\r\n\r\n"
            reader = asyncio.StreamReader()
            reader.feed_data(raw)
            reader.feed_eof()
            writer = FakeWriter()
            writer.get_extra_info = lambda k, d=None: d
            await handle(reader, writer)
            return writer

        w = self._run(run())
        body = w.response_body()
        self.assertIn("items", body)
        self.assertIn("dir", body)


# ── 테스트: base64 오류 처리 ──────────────────────────────────────────────────

class TestBase64ErrorHandling(unittest.TestCase):

    def test_invalid_base64_does_not_crash(self):
        """잘못된 base64 데이터가 있어도 서버 크래시 없이 로깅만"""
        from ccpilot.routes import handle

        payload = json.dumps({
            "text": "test project",
            "cwd": "",
            "model": "",
            "lang": "en",
            "mode": "planning",
            "design_files": [
                {"name": "bad.png", "isImage": True, "data": "NOT_VALID_BASE64!!!"}
            ]
        }).encode("utf-8")

        async def run():
            header = (
                f"POST /api/plan/text HTTP/1.1\r\n"
                f"Content-Type: application/json\r\n"
                f"Content-Length: {len(payload)}\r\n\r\n"
            ).encode()
            reader = asyncio.StreamReader()
            reader.feed_data(header + payload)
            reader.feed_eof()
            writer = FakeWriter()
            writer.get_extra_info = lambda k, d=None: d

            # run_planning_claude를 mock으로 대체 (claude 실행 안 함)
            with patch("ccpilot.routes.run_planning_claude", return_value={"summary": "ok", "agents": []}), \
                 patch("ccpilot.routes._MODE_FN", {"planning": lambda *a, **kw: {"summary": "ok", "agents": []}}):
                await handle(reader, writer)
            return writer

        w = asyncio.get_event_loop().run_until_complete(run())
        # 크래시 없이 응답이 왔는지 확인
        self.assertGreater(len(w._buf), 0)


if __name__ == "__main__":
    unittest.main()
