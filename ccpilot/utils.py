"""CCPilot -- utilities and constants."""

import os
import shutil
import sys
from pathlib import Path

# ── MIME / static dir ──────────────────────────────────────────────────────────

# PyInstaller 환경에서는 sys._MEIPASS, 일반 실행 시는 프로젝트 루트
_BASE = Path(sys._MEIPASS) if getattr(sys, "frozen", False) else Path(__file__).parent.parent
STATIC_DIR = _BASE / "public"

MIME = {
    ".html": "text/html; charset=utf-8",
    ".css":  "text/css; charset=utf-8",
    ".js":   "application/javascript; charset=utf-8",
}

# ── 기본 프로젝트 디렉토리 ────────────────────────────────────────────────────

_BASE_PROJECTS_DIR = Path(__file__).parent.parent / "projects"


def default_projects_dir() -> Path:
    """경로 미입력 시 기본값: 프로젝트 루트 옆 projects/ 폴더."""
    _BASE_PROJECTS_DIR.mkdir(exist_ok=True)
    return _BASE_PROJECTS_DIR


def resolve_cwd(cwd_req: str, subdir: str = "") -> str:
    """
    cwd_req 가 비어 있으면 projects/ 를 기본으로 사용.
    subdir 이 있으면 그 하위 폴더를 만들어 반환.
    """
    if cwd_req:
        base = Path(cwd_req)
    else:
        base = default_projects_dir()
    target = base / subdir if subdir else base
    try:
        target.mkdir(parents=True, exist_ok=True)
    except Exception:
        target = default_projects_dir()
    return str(target)


# ── claude 실행 커맨드 ────────────────────────────────────────────────────────

def find_claude() -> list[str] | None:
    if sys.platform == "win32":
        node = shutil.which("node")
        cli  = Path(os.environ.get("APPDATA", "")) / "npm" / "node_modules" / "@anthropic-ai" / "claude-code" / "cli.js"
        if node and cli.exists():
            return [node, str(cli)]
    else:
        b = shutil.which("claude")
        if b:
            return [b]
    return None


def clean_env() -> dict:
    return {k: v for k, v in os.environ.items()
            if not k.startswith("CLAUDECODE") and not k.startswith("CLAUDE_CODE")}


# ── slash command 자동 수집 ────────────────────────────────────────────────────

def _read_skill_desc(skill_path: Path) -> str:
    """SKILL.md frontmatter에서 description 추출"""
    skill_md = skill_path / "SKILL.md"
    if not skill_md.exists():
        return ""
    try:
        text = skill_md.read_text(encoding="utf-8", errors="replace")
        if text.startswith("---"):
            parts_fm = text.split("---", 2)
            if len(parts_fm) >= 3:
                for line in parts_fm[1].splitlines():
                    if line.lower().startswith("description:"):
                        desc = line.split(":", 1)[1].strip()
                        return desc[:60] + ("..." if len(desc) > 60 else "")
    except Exception:
        pass
    return ""


def collect_slash_commands(cwd: str) -> list[dict]:
    """
    Claude Code가 실제로 노출하는 slash command 목록을 수집.
    1) Built-in 내장 명령 (항상 포함)
    2) ~/.claude/skills/<name>/  -> /<name>
    3) ~/.claude/commands/<name>.md  -> /<name>
    4) <cwd>/.claude/commands/<name>.md  -> /<name>
    각 항목: {"name": "/foo", "description": "...", "source": "builtin|skill|user|project"}
    """
    results: dict[str, dict] = {}

    def add(name: str, desc: str, source: str):
        key = name if name.startswith("/") else "/" + name
        if key not in results:
            results[key] = {"name": key, "description": desc, "source": source}

    # 1. Built-in (Claude Code 내장 명령 + 내장 skills)
    builtins = [
        ("clear",                  "Claude context + 화면 초기화",                    "builtin"),
        ("compact",                "대화 내용 요약 압축",                              "builtin"),
        ("cost",                   "세션 비용 및 토큰 사용량 표시",                    "builtin"),
        ("context",                "현재 컨텍스트 확인",                              "builtin"),
        ("help",                   "도움말",                                         "builtin"),
        ("init",                   "프로젝트 초기화 (CLAUDE.md 생성)",                "builtin"),
        ("model",                  "모델 변경",                                      "builtin"),
        ("review",                 "코드 리뷰",                                      "builtin"),
        ("pr-comments",            "PR 코멘트 조회",                                 "builtin"),
        ("release-notes",          "릴리스 노트 생성",                               "builtin"),
        ("security-review",        "보안 리뷰",                                      "builtin"),
        ("extra-usage",            "상세 사용량 조회",                                "builtin"),
        ("insights",               "인사이트",                                       "builtin"),
        # Claude Code 내장 skills (cli.js에 하드코딩)
        ("keybindings-help",       "키바인딩 커스터마이즈 도움말",                    "skill"),
        ("debug",                  "디버그 정보 출력",                               "skill"),
        ("claude-developer-platform","Claude API/SDK 개발 도우미",                  "skill"),
    ]
    for name, desc, src in builtins:
        add(name, desc, src)

    home = Path.home()

    # 2. ~/.claude/skills/<name>/  (사용자 설치 skills)
    skills_dir = home / ".claude" / "skills"
    if skills_dir.is_dir():
        for skill_path in sorted(skills_dir.iterdir()):
            if not skill_path.is_dir():
                continue
            name = skill_path.name
            desc = _read_skill_desc(skill_path) or f"skill: {name}"
            add(name, desc, "skill")

    # 2b. Claude Code 패키지 내장 skills (keybindings-help, debug 등)
    _npm_prefix = None
    try:
        if sys.platform == "win32":
            appdata = Path(os.environ.get("APPDATA", ""))
            _npm_prefix = appdata / "npm" / "node_modules" / "@anthropic-ai" / "claude-code"
        else:
            _npm_bin = shutil.which("claude")
            if _npm_bin:
                _npm_prefix = Path(_npm_bin).resolve().parents[2] / "@anthropic-ai" / "claude-code"
    except Exception:
        pass
    if _npm_prefix:
        for skills_subdir in (_npm_prefix / "skills", _npm_prefix / "dist" / "skills"):
            if skills_subdir.is_dir():
                for skill_path in sorted(skills_subdir.iterdir()):
                    if skill_path.is_dir():
                        name = skill_path.name
                        desc = _read_skill_desc(skill_path) or f"built-in skill: {name}"
                        add(name, desc, "skill")

    # 3. ~/.claude/commands/<name>.md  (user-level custom slash commands)
    for base in (home / ".claude" / "commands", Path(cwd) / ".claude" / "commands"):
        if base.is_dir():
            src = "project" if "claude" in str(base.parent) and cwd in str(base) else "user"
            for md in sorted(base.glob("*.md")):
                name = md.stem
                desc = ""
                try:
                    first = md.read_text(encoding="utf-8", errors="replace").strip().splitlines()
                    # 첫 번째 비어있지 않은 줄을 설명으로
                    for line in first:
                        line = line.strip().lstrip("#").strip()
                        if line:
                            desc = line[:60]
                            break
                except Exception:
                    pass
                if not desc:
                    desc = f"custom command: {name}"
                add(name, desc, src)

    return sorted(results.values(), key=lambda x: x["name"])


# ── HTTP 파싱 헬퍼 ────────────────────────────────────────────────────────────

def parse_content_length(hs: str) -> int:
    for line in hs.split("\r\n"):
        if line.lower().startswith("content-length:"):
            try:
                return int(line.split(":", 1)[1].strip())
            except Exception:
                pass
    return 0


def parse_multipart(body: bytes, boundary: str) -> dict[str, tuple[str | None, bytes]]:
    """
    multipart/form-data 파싱.
    반환: {field_name: (filename_or_None, data_bytes)}
    """
    sep = ("--" + boundary).encode()
    result: dict[str, tuple[str | None, bytes]] = {}
    parts = body.split(sep)
    for part in parts[1:]:
        if part.startswith(b"--"):
            break
        if b"\r\n\r\n" not in part:
            continue
        head_raw, _, content = part.partition(b"\r\n\r\n")
        content = content.rstrip(b"\r\n")
        head_str = head_raw.decode(errors="replace")
        name = filename = None
        for seg in head_str.split(";"):
            seg = seg.strip()
            if seg.startswith("name="):
                name = seg[5:].strip('"')
            elif seg.startswith("filename="):
                filename = seg[9:].strip('"')
        if name:
            result[name] = (filename, content)
    return result


# ── 정적 파일 서빙 ────────────────────────────────────────────────────────────

def serve_static(path_str: str) -> tuple[bytes, str] | None:
    """경로에 해당하는 static 파일을 읽어 (bytes, content_type) 반환. 없으면 None."""
    try:
        rel = path_str.lstrip("/")
        p = (STATIC_DIR / rel).resolve()
        # 경로 탈출 방지
        p.relative_to(STATIC_DIR.resolve())
        if not p.is_file():
            return None
        data = p.read_bytes()
        ct = MIME.get(p.suffix, "application/octet-stream")
        return data, ct
    except Exception:
        return None
