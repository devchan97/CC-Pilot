"""session.py 단위 테스트 — Session 초기화, 상태, usage_limit 처리"""
import sys
import os
import unittest
import threading

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from ccpilot.session import Session
from ccpilot.types import EventType


class TestSessionInit(unittest.TestCase):

    def test_default_fields(self):
        s = Session("abc123", "/tmp/cwd")
        self.assertEqual(s.id, "abc123")
        self.assertEqual(s.cwd, "/tmp/cwd")
        self.assertEqual(s.phase, "backlog")
        self.assertEqual(s.last_response, "")
        self.assertIsNone(s._session_id)
        self.assertIsNone(s.project_id)

    def test_status_initial_values(self):
        s = Session("abc123", "/tmp/cwd", model="sonnet")
        self.assertEqual(s.status["model"], "sonnet")
        self.assertFalse(s.status["thinking"])
        self.assertFalse(s.status["waiting_for_reset"])
        self.assertEqual(s.status["reset_time"], "")
        self.assertEqual(s.status["ctx_pct"], 0)
        self.assertEqual(s.status["cost_usd"], 0.0)

    def test_hidden_responded_is_threading_event(self):
        s = Session("abc123", "/tmp")
        self.assertIsInstance(s._is_hidden_responded, threading.Event)


class TestExtractResetTime(unittest.TestCase):

    def setUp(self):
        self.s = Session("t1", "/tmp")

    def test_parses_reset_time(self):
        msg = "Claude usage limit reached. Your limit will reset at 5pm (Europe/Warsaw)."
        result = self.s._extract_reset_time(msg)
        self.assertIsNotNone(result)
        self.assertIn("5pm", result)

    def test_parses_reset_time_no_dot(self):
        msg = "Usage limit reached. Reset at 10am (America/New_York)"
        result = self.s._extract_reset_time(msg)
        self.assertIsNotNone(result)
        self.assertIn("10am", result)

    def test_returns_none_when_no_reset_time(self):
        msg = "Some other error without reset time info"
        result = self.s._extract_reset_time(msg)
        self.assertIsNone(result)


class TestEnterWaitMode(unittest.TestCase):

    def setUp(self):
        self.s = Session("t1", "/tmp")
        self.published = []
        self.s._publish_fn = lambda sid, msg: self.published.append(msg)

    def test_sets_waiting_for_reset(self):
        self.s._enter_wait_mode("5pm (UTC)")
        self.assertTrue(self.s.status["waiting_for_reset"])
        self.assertEqual(self.s.status["reset_time"], "5pm (UTC)")
        self.assertFalse(self.s.status["thinking"])

    def test_publishes_status_event(self):
        self.s._enter_wait_mode(None)
        self.assertEqual(len(self.published), 1)
        self.assertEqual(self.published[0]["type"], EventType.STATUS)

    def test_reset_time_none_stored_as_empty(self):
        self.s._enter_wait_mode(None)
        self.assertEqual(self.s.status["reset_time"], "")


class TestSendClearsWaitMode(unittest.TestCase):
    """send() 호출 시 waiting_for_reset 자동 해제 확인"""

    def test_wait_mode_cleared_on_send(self):
        s = Session("t1", "/tmp")
        published = []
        s._publish_fn = lambda sid, msg: published.append(msg)
        # 대기 모드 진입
        s.status["waiting_for_reset"] = True
        s.status["reset_time"] = "5pm"

        # find_claude가 None을 반환하도록 mock → send()가 즉시 리턴
        import unittest.mock as mock
        with mock.patch("ccpilot.session.find_claude", return_value=None):
            s.send("hello")

        self.assertFalse(s.status["waiting_for_reset"])
        self.assertEqual(s.status["reset_time"], "")


class TestSessionManagerCrud(unittest.TestCase):

    def setUp(self):
        import tempfile, shutil
        import ccpilot.db as db_module
        self.tmp_dir = tempfile.mkdtemp()
        self.orig_db = db_module.DB_FILE
        db_module.DB_FILE = type(db_module.DB_FILE)(os.path.join(self.tmp_dir, "test.db"))
        db_module.init_db()
        from ccpilot.session import SessionManager
        self.mgr = SessionManager()

    def tearDown(self):
        import ccpilot.db as db_module
        import shutil
        db_module.DB_FILE = self.orig_db
        shutil.rmtree(self.tmp_dir, ignore_errors=True)

    def test_create_and_get(self):
        s = self.mgr.create("/tmp/test", model="sonnet", title="Task 1")
        self.assertIsNotNone(self.mgr.get(s.id))
        self.assertEqual(s.title, "Task 1")

    def test_remove(self):
        s = self.mgr.create("/tmp/test")
        self.mgr.remove(s.id)
        self.assertIsNone(self.mgr.get(s.id))

    def test_move_phase(self):
        published = []
        s = self.mgr.create("/tmp/test")
        self.mgr._loop = None  # publish는 loop 없으면 no-op
        self.mgr.move_phase(s.id, "done")
        self.assertEqual(self.mgr.get(s.id).phase, "done")

    def test_rename(self):
        s = self.mgr.create("/tmp/test", title="Old")
        self.mgr.rename(s.id, "New Title")
        self.assertEqual(self.mgr.get(s.id).title, "New Title")

    def test_restore(self):
        data = {
            "id": "restored1",
            "cwd": "/tmp/restored",
            "model": "opus",
            "title": "Restored Task",
            "phase": "inprogress",
            "project_id": "proj1",
            "claude_sid": "claude-abc",
            "status": {},
            "last_response": "last output",
        }
        s = self.mgr.restore(data)
        self.assertEqual(s.id, "restored1")
        self.assertEqual(s.title, "Restored Task")
        self.assertEqual(s._session_id, "claude-abc")
        self.assertEqual(s.last_response, "last output")


if __name__ == "__main__":
    unittest.main()
