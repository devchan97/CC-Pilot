"""db.py 마이그레이션 테스트 — JSON → SQLite"""
import sys
import os
import unittest
import json
import tempfile
import shutil

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


class TestDbMigration(unittest.TestCase):
    """기존 JSON 파일이 있을 때 SQLite로 자동 마이그레이션되는지 검증"""

    def setUp(self):
        import ccpilot.db as db_module
        self.db_module = db_module
        self.tmp_dir = tempfile.mkdtemp()
        self.orig_db = db_module.DB_FILE
        self.test_db = type(db_module.DB_FILE)(os.path.join(self.tmp_dir, "test.db"))
        db_module.DB_FILE = self.test_db

    def tearDown(self):
        self.db_module.DB_FILE = self.orig_db
        shutil.rmtree(self.tmp_dir, ignore_errors=True)

    def test_init_creates_tables(self):
        """init_db() 후 projects/sessions 테이블이 존재해야 함"""
        import sqlite3
        self.db_module.init_db()
        with sqlite3.connect(self.test_db) as conn:
            tables = {row[0] for row in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            )}
        self.assertIn("projects", tables)
        self.assertIn("sessions", tables)

    def test_projects_json_migrated(self):
        """projects.json이 있으면 SQLite로 마이그레이션"""
        projects_data = [
            {"id": "p1", "name": "Migrated Project", "root_cwd": "", "created_at": "2024-01-01"}
        ]
        projects_json = self.test_db.parent / "projects.json"
        projects_json.write_text(json.dumps(projects_data), encoding="utf-8")

        self.db_module.init_db()
        result = self.db_module.get_projects()
        names = [p["name"] for p in result]
        self.assertIn("Migrated Project", names)
        # 원본 JSON은 .bak으로 이름 변경됨
        self.assertTrue((self.test_db.parent / "projects.json.bak").exists())

    def test_sessions_json_migrated(self):
        """sessions.json이 있으면 SQLite로 마이그레이션"""
        sessions_data = [
            {"id": "s1", "cwd": "/tmp", "model": "", "title": "Migrated Session",
             "phase": "backlog", "project_id": None, "claude_sid": None,
             "status": {}, "last_response": ""}
        ]
        sessions_json = self.test_db.parent / "sessions.json"
        sessions_json.write_text(json.dumps(sessions_data), encoding="utf-8")

        self.db_module.init_db()
        result = self.db_module.load_sessions()
        titles = [s["title"] for s in result]
        self.assertIn("Migrated Session", titles)
        self.assertTrue((self.test_db.parent / "sessions.json.bak").exists())

    def test_init_idempotent(self):
        """init_db()를 여러 번 호출해도 데이터 중복 없음"""
        self.db_module.init_db()
        self.db_module.save_projects([{"id": "p1", "name": "A", "root_cwd": "", "created_at": ""}])
        self.db_module.init_db()  # 두 번째 호출
        result = self.db_module.get_projects()
        self.assertEqual(len(result), 1)


if __name__ == "__main__":
    unittest.main()
