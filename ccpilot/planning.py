"""CCPilot -- Planning (Agent Team auto-generation)."""

import base64 as _b64
import json
import re
import subprocess
from pathlib import Path

from ccpilot.utils import find_claude, build_claude_cmd, clean_env, no_window_kwargs, resolve_cwd, parse_claude_json

# ── Planning prompt ───────────────────────────────────────────────────────────

# 영어 Planning prompt (기본)
PLANNING_PROMPT = """You are a software project planning expert. Analyze the given project documentation and design a Claude Code agent team to work in parallel.

**Respond ONLY in the following JSON format. Output ONLY valid JSON — no markdown code blocks, no explanatory text:**

{
  "summary": "One-line project summary",
  "prerequisites": [
    {"label": "Item name (e.g. Install Node.js 18+)", "detail": "One-line verification or download link (optional)"}
  ],
  "agents": [
    {
      "role": "backend",
      "title": "Backend Developer",
      "cwd_suffix": "backend",
      "init_prompt": "Specific first task description (2-3 sentences)",
      "phase": "inprogress"
    }
  ]
}

Rules:
1. Design 2-6 agents based on project complexity.
2. Each agent should handle an independent module (backend, frontend, database, etc.) for true parallel work.
3. cwd_suffix is a relative sub-directory path within the project root. Lowercase English, no slashes.
4. init_prompt must be specific and actionable — the agent should start immediately without additional explanation.
5. Include only what is necessary in prerequisites (tools to install, API keys to set, etc.). Return empty array [] if none needed.
6. The summary should be a concise one-line description of the project.
7. Roles must be lowercase English (backend, frontend, devops, ml, data, etc.).
8. init_prompt should reference AGENTS.md for team context: start with "Read AGENTS.md for team context."
9. For projects requiring parallel sub-modules, add: "For independent sub-modules, use Task tool to parallelize."
10. Output must be valid JSON parseable by Python's json.loads().
11. init_prompt must include: 1) Check available skills with /skills command. 2) For complex sub-tasks, use Claude Code Agent Teams (claude --agents) for parallel processing."""

# 한국어 Planning prompt
KO_PLANNING_PROMPT = """당신은 소프트웨어 프로젝트 플래닝 전문가입니다.
주어진 프로젝트 문서를 분석하여 병렬로 작업할 Claude Code 에이전트 팀을 설계하세요.

**반드시 아래 JSON 형식으로만 응답하세요. 마크다운 코드블록, 설명 텍스트 없이 JSON만 출력:**
{
  "summary": "프로젝트 한 줄 요약",
  "prerequisites": [
    {
      "label": "항목 이름 (예: Unity 2022.3 LTS 설치)",
      "detail": "확인 방법 또는 다운로드 링크 등 한 줄 설명 (선택)"
    }
  ],
  "agents": [
    {
      "role": "frontend",
      "title": "Frontend Dev",
      "cwd_suffix": "frontend",
      "init_prompt": "구체적인 첫 번째 태스크 설명 (한국어, 2-3문장)",
      "phase": "inprogress"
    }
  ]
}

규칙:
- prerequisites: 에이전트 실행 전 사용자가 반드시 준비해야 할 항목 목록.
  프레임워크·엔진·SDK 설치, 계정/API 키, 기존 프로젝트 경로 설정, 환경 변수 등 포함.
  일반 웹/CLI 프로젝트처럼 별도 준비가 필요 없으면 빈 배열 [] 반환.
  예시(Unity): Unity Editor, Android/iOS Build Support 모듈, 프로젝트 폴더 준비
  예시(게임엔진): Unreal Engine 설치, Visual Studio C++ 툴체인
  예시(AI/ML): Python 환경, CUDA 드라이버, API 키(OpenAI 등)
- 에이전트는 2~5개 (프로젝트 규모에 맞게)
- cwd_suffix: 소문자 영문, 슬래시 없음 (예: frontend, backend, db, infra, testing)
- init_prompt: 해당 에이전트가 즉시 실행할 수 있는 구체적 태스크. 반드시 아래 두 가지를 포함:
  1) Claude Code의 /skills 명령으로 사용 가능한 스킬(notebooklm, unity-cli 등)을 적극 활용하도록 안내
  2) 복잡한 서브태스크는 Claude Code의 Agent Teams 기능(claude --agents)을 활용해 병렬 처리하도록 안내
- phase: 항상 "inprogress"
- 프로젝트 문서가 불명확해도 합리적으로 추론해서 제안"""


def run_planning_claude(text: str, cwd: str, model: str, lang: str = 'en', images=None) -> dict:
    """
    Planning Claude를 실행해 에이전트 팀 구성 JSON을 반환.
    blocking 함수 -> 스레드에서 호출.
    반환: {"summary": "...", "agents": [...]} 또는 {"error": "..."}
    images: [(bytes, mime_type_str), ...] 리스트 또는 None
    """
    # 언어에 따라 프롬프트 선택
    planning_prompt = KO_PLANNING_PROMPT if lang == 'ko' else PLANNING_PROMPT
    doc_label = "프로젝트 문서" if lang == 'ko' else "Project Documentation"
    prompt = f"{planning_prompt}\n\n---\n{doc_label}:\n{text}"

    has_images = bool(images)

    cmd = build_claude_cmd(model=model, has_images=has_images)
    if not cmd:
        return {"error": "claude를 찾을 수 없습니다."}
    if not has_images:
        cmd += [prompt]

    try:
        proc = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE if has_images else None,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=clean_env(),
            cwd=resolve_cwd(cwd) if cwd else None,
            **no_window_kwargs(),
        )
    except Exception as e:
        return {"error": str(e)}

    if has_images:
        content_blocks = [{"type": "text", "text": prompt}]
        for img_bytes, mime_type in images:
            b64_data = _b64.b64encode(img_bytes).decode()
            content_blocks.append({
                "type": "image",
                "source": {"type": "base64", "media_type": mime_type, "data": b64_data}
            })
        msg_line = json.dumps({
            "type": "user",
            "message": {"role": "user", "content": content_blocks}
        }) + "\n"
        try:
            proc.stdin.write(msg_line.encode("utf-8"))
            proc.stdin.close()
        except Exception:
            pass

    full_text = ""
    try:
        for raw in proc.stdout:
            try:
                line = raw.decode("utf-8", errors="replace").strip()
            except Exception:
                continue
            if not line:
                continue
            try:
                ev = json.loads(line)
            except Exception:
                continue
            t = ev.get("type", "")
            if t == "assistant":
                for block in (ev.get("message") or {}).get("content", []):
                    if block.get("type") == "text":
                        full_text += block["text"]
            elif t == "result":
                result_text = ev.get("result", "")
                if result_text and not full_text:
                    full_text = result_text
    except Exception:
        pass

    proc.wait()

    return parse_claude_json(full_text)


def write_agents_md(root_cwd: str, summary: str, agents: list[dict], lang: str = 'ko'):
    """각 에이전트 작업 디렉토리에 AGENTS.md 생성 + CLAUDE.md에 메모리 저장 지시 추가."""
    if lang == 'en':
        team_lines = ["# Agent Team\n",
                      f"**Project:** {summary}\n",
                      "## Members\n"]
        for a in agents:
            cwd_suffix = a.get("cwd_suffix", ".")
            team_lines.append(f"### {a['title']} ({a.get('role','')})\n")
            team_lines.append(f"- **Directory:** `{cwd_suffix}`\n")
            team_lines.append(f"- **Task:** {a.get('init_prompt','')}\n\n")
        team_lines += [
            "## Guidelines\n",
            "- Read this file first for team context.\n",
            "- Use the Task tool for independent sub-modules to parallelize work.\n",
            "- Check `/skills` for available tools.\n",
        ]
        claude_md_addition = (
            "\n\n## CCPilot Agent Memory\n"
            f"> Project: {summary}\n"
            ">\n"
            "> **Follow these instructions:**\n"
            "> - Read `AGENTS.md` at the start for team structure and shared rules.\n"
            "> - Record key decisions, completed items, and interface changes in the 'Progress' section of `AGENTS.md`.\n"
            "> - Save important context (architecture, env vars, config) to this `CLAUDE.md` so it persists across session restarts.\n"
        )
    else:
        team_lines = ["# Agent Team\n",
                      f"## 프로젝트 요약\n{summary}\n",
                      "## 팀 구성\n"]
        for a in agents:
            cwd_suffix = a.get("cwd_suffix", ".")
            team_lines.append(f"- **{a['title']}** (`{cwd_suffix}`) -- {a.get('role','')}\n")
        team_lines += [
            "\n## 공유 규칙\n",
            "- 이 파일을 읽고 다른 에이전트의 작업 영역을 침범하지 마세요.\n",
            "- 공통 인터페이스(API 스펙, DB 스키마 등)는 이 파일에 업데이트하세요.\n",
            "- 완료한 태스크는 아래 '진행 상황' 섹션에 기록하세요.\n",
            "\n## 진행 상황\n",
            "<!-- 각 에이전트가 여기에 진행 상황을 업데이트 -->\n",
        ]
        claude_md_addition = (
            "\n\n## CCPilot Agent Memory\n"
            f"> 프로젝트: {summary}\n"
            ">\n"
            "> **이 지시사항을 반드시 따르세요:**\n"
            "> - 작업 시작 시 `AGENTS.md`를 읽어 팀 구성과 공유 규칙을 파악하세요.\n"
            "> - 주요 결정사항·완료 항목·인터페이스 변경은 `AGENTS.md`의 '진행 상황' 섹션에 기록하세요.\n"
            "> - 중요한 컨텍스트(아키텍처, 환경 변수, 설정값 등)는 이 `CLAUDE.md`에 저장하여 세션 재시작 후에도 유지하세요.\n"
        )
    team_content = "".join(team_lines)

    root = Path(root_cwd)
    try:
        root.mkdir(parents=True, exist_ok=True)
        # 프로젝트 루트에 AGENTS.md
        (root / "AGENTS.md").write_text(team_content, encoding="utf-8")
    except Exception:
        pass

    # 각 에이전트 작업 디렉토리에도 AGENTS.md 복사 + CLAUDE.md 생성
    for a in agents:
        cwd_suffix = a.get("cwd_suffix", "")
        if not cwd_suffix:
            continue
        agent_dir = root / cwd_suffix
        try:
            agent_dir.mkdir(parents=True, exist_ok=True)
            # AGENTS.md 복사
            (agent_dir / "AGENTS.md").write_text(team_content, encoding="utf-8")
            # CLAUDE.md: 기존 내용 유지 + CCPilot 섹션 추가
            claude_md_path = agent_dir / "CLAUDE.md"
            existing = ""
            if claude_md_path.exists():
                try:
                    existing = claude_md_path.read_text(encoding="utf-8")
                except Exception:
                    existing = ""
            if "CCPilot Agent Memory" not in existing:
                claude_md_path.write_text(existing + claude_md_addition, encoding="utf-8")
        except Exception:
            pass
