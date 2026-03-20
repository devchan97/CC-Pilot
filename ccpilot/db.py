"""CCPilot -- SQLite Database Manager."""

import json
import sqlite3
import sys
import threading
import logging
from pathlib import Path

DB_FILE = (Path(sys.executable).parent if getattr(sys, "frozen", False) else Path(__file__).parent.parent) / "ccpilot.db"

_db_lock = threading.Lock()

def init_db():
    with _db_lock:
        with sqlite3.connect(DB_FILE) as conn:
            conn.execute('''
                CREATE TABLE IF NOT EXISTS projects (
                    id TEXT PRIMARY KEY,
                    data TEXT NOT NULL
                )
            ''')
            conn.execute('''
                CREATE TABLE IF NOT EXISTS sessions (
                    id TEXT PRIMARY KEY,
                    data TEXT NOT NULL
                )
            ''')
            
            # Migrate old JSON files if the tables are empty
            projects_json = DB_FILE.with_name("projects.json")
            if projects_json.exists():
                cursor = conn.execute("SELECT COUNT(*) FROM projects")
                if cursor.fetchone()[0] == 0:
                    try:
                        data = json.loads(projects_json.read_text(encoding="utf-8"))
                        for p in data:
                            conn.execute("INSERT OR IGNORE INTO projects(id, data) VALUES (?, ?)",
                                         (p["id"], json.dumps(p, ensure_ascii=False)))
                        projects_json.rename(projects_json.with_suffix(".json.bak"))
                    except Exception as e:
                        logging.warning("Failed to migrate projects.json: %s", e)
            
            sessions_json = DB_FILE.with_name("sessions.json")
            if sessions_json.exists():
                cursor = conn.execute("SELECT COUNT(*) FROM sessions")
                if cursor.fetchone()[0] == 0:
                    try:
                        data = json.loads(sessions_json.read_text(encoding="utf-8"))
                        for s in data:
                            conn.execute("INSERT OR IGNORE INTO sessions(id, data) VALUES (?, ?)",
                                         (s["id"], json.dumps(s, ensure_ascii=False)))
                        sessions_json.rename(sessions_json.with_suffix(".json.bak"))
                    except Exception as e:
                        logging.warning("Failed to migrate sessions.json: %s", e)
            conn.commit()

init_db()

def get_projects() -> list[dict]:
    with _db_lock:
        with sqlite3.connect(DB_FILE) as conn:
            cursor = conn.execute("SELECT data FROM projects")
            return [json.loads(row[0]) for row in cursor]

def save_projects(project_list: list[dict]):
    with _db_lock:
        with sqlite3.connect(DB_FILE) as conn:
            conn.execute("BEGIN TRANSACTION")
            conn.execute("DELETE FROM projects")
            conn.executemany(
                "INSERT INTO projects(id, data) VALUES (?, ?)",
                [(p["id"], json.dumps(p, ensure_ascii=False)) for p in project_list]
            )
            conn.commit()

def load_sessions() -> list[dict]:
    with _db_lock:
        with sqlite3.connect(DB_FILE) as conn:
            cursor = conn.execute("SELECT data FROM sessions")
            return [json.loads(row[0]) for row in cursor]

def save_sessions(session_list: list[dict]):
    with _db_lock:
        with sqlite3.connect(DB_FILE) as conn:
            conn.execute("BEGIN TRANSACTION")
            conn.execute("DELETE FROM sessions")
            conn.executemany(
                "INSERT INTO sessions(id, data) VALUES (?, ?)",
                [(s["id"], json.dumps(s, ensure_ascii=False)) for s in session_list]
            )
            conn.commit()
