"""db.py / projects.py 단위 테스트 — 실제 DB API에 맞게 작성"""
import sys
import os
import unittest
import tempfile
import shutil

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


class TestDbOperations(unittest.TestCase):
    """ccpilot.db의 실제 함수(get_projects, save_projects, load_sessions, save_sessions) 테스트"""

    def setUp(self):
        """각 테스트마다 임시 DB 파일 사용"""
        import ccpilot.db as db_module
        self.tmp_dir = tempfile.mkdtemp()
        self.orig_db = db_module.DB_FILE
        db_module.DB_FILE = type(db_module.DB_FILE)(os.path.join(self.tmp_dir, "test.db"))
        # 임시 DB 초기화
        db_module.init_db()

    def tearDown(self):
        import ccpilot.db as db_module
        db_module.DB_FILE = self.orig_db
        shutil.rmtree(self.tmp_dir, ignore_errors=True)

    def test_save_and_get_projects(self):
        from ccpilot.db import save_projects, get_projects
        projects = [
            {"id": "p1", "name": "Project A", "root_cwd": "/tmp/a", "created_at": "2024-01-01"},
            {"id": "p2", "name": "Project B", "root_cwd": "/tmp/b", "created_at": "2024-01-02"},
        ]
        save_projects(projects)
        result = get_projects()
        ids = {p["id"] for p in result}
        self.assertIn("p1", ids)
        self.assertIn("p2", ids)

    def test_save_projects_overwrites(self):
        """save_projects는 기존 데이터를 완전히 교체"""
        from ccpilot.db import save_projects, get_projects
        save_projects([{"id": "old", "name": "Old", "root_cwd": "", "created_at": "2024-01-01"}])
        save_projects([{"id": "new", "name": "New", "root_cwd": "", "created_at": "2024-01-02"}])
        result = get_projects()
        ids = {p["id"] for p in result}
        self.assertNotIn("old", ids)
        self.assertIn("new", ids)

    def test_save_and_load_sessions(self):
        from ccpilot.db import save_sessions, load_sessions
        sessions = [
            {"id": "s1", "cwd": "/tmp/s1", "model": "sonnet", "title": "Task 1",
             "phase": "inprogress", "project_id": None, "claude_sid": None,
             "status": {}, "last_response": ""},
        ]
        save_sessions(sessions)
        result = load_sessions()
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["id"], "s1")
        self.assertEqual(result[0]["title"], "Task 1")

    def test_empty_db_returns_empty_lists(self):
        from ccpilot.db import get_projects, load_sessions
        self.assertEqual(get_projects(), [])
        self.assertEqual(load_sessions(), [])


class TestProjectManager(unittest.TestCase):
    """ccpilot.projects.ProjectManager CRUD 테스트"""

    def setUp(self):
        import ccpilot.db as db_module
        self.tmp_dir = tempfile.mkdtemp()
        self.orig_db = db_module.DB_FILE
        db_module.DB_FILE = type(db_module.DB_FILE)(os.path.join(self.tmp_dir, "test.db"))
        db_module.init_db()
        # 새 ProjectManager 인스턴스 (싱글톤 PROJ_MGR 대신)
        from ccpilot.projects import ProjectManager
        self.pm = ProjectManager()

    def tearDown(self):
        import ccpilot.db as db_module
        db_module.DB_FILE = self.orig_db
        shutil.rmtree(self.tmp_dir, ignore_errors=True)

    def test_create_and_get(self):
        p = self.pm.create("My Project", "/tmp/myproj")
        self.assertIn("id", p)
        self.assertEqual(p["name"], "My Project")
        got = self.pm.get(p["id"])
        self.assertIsNotNone(got)
        self.assertEqual(got["name"], "My Project")

    def test_list_all(self):
        self.pm.create("A")
        self.pm.create("B")
        projects = self.pm.list_all()
        names = {p["name"] for p in projects}
        self.assertIn("A", names)
        self.assertIn("B", names)

    def test_rename(self):
        p = self.pm.create("Old Name")
        ok = self.pm.rename(p["id"], "New Name")
        self.assertTrue(ok)
        self.assertEqual(self.pm.get(p["id"])["name"], "New Name")

    def test_rename_nonexistent_returns_false(self):
        ok = self.pm.rename("nonexistent", "New")
        self.assertFalse(ok)

    def test_remove(self):
        p = self.pm.create("ToDelete")
        ok = self.pm.remove(p["id"])
        self.assertTrue(ok)
        self.assertIsNone(self.pm.get(p["id"]))

    def test_remove_nonexistent_returns_false(self):
        ok = self.pm.remove("ghost")
        self.assertFalse(ok)


if __name__ == "__main__":
    unittest.main()
