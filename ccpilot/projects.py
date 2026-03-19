"""CCPilot -- ProjectManager."""

import json
import threading
import uuid
from datetime import datetime
from pathlib import Path


# ── 프로젝트 매니저 ───────────────────────────────────────────────────────────

class ProjectManager:
    SAVE_FILE = Path(__file__).parent.parent / "projects.json"

    def __init__(self):
        self._lock = threading.Lock()
        self._projects: dict[str, dict] = {}
        self._load_init()

    def _load_init(self):
        try:
            if self.SAVE_FILE.exists():
                data = json.loads(self.SAVE_FILE.read_text(encoding="utf-8"))
                for p in data:
                    self._projects[p["id"]] = p
        except Exception:
            pass

    def _save(self):
        try:
            with self._lock:
                data = list(self._projects.values())
            self.SAVE_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        except Exception:
            pass

    def list_all(self) -> list[dict]:
        with self._lock:
            return list(self._projects.values())

    def get(self, pid: str) -> dict | None:
        with self._lock:
            return self._projects.get(pid)

    def create(self, name: str, root_cwd: str = "") -> dict:
        pid = str(uuid.uuid4())[:8]
        p = {"id": pid, "name": name, "root_cwd": root_cwd,
             "created_at": datetime.now().isoformat()}
        with self._lock:
            self._projects[pid] = p
        self._save()
        return p

    def rename(self, pid: str, name: str) -> bool:
        with self._lock:
            if pid not in self._projects:
                return False
            self._projects[pid]["name"] = name
        self._save()
        return True

    def remove(self, pid: str) -> bool:
        with self._lock:
            if pid not in self._projects:
                return False
            del self._projects[pid]
        self._save()
        return True


PROJ_MGR = ProjectManager()
