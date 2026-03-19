"""CCPilot -- Planning (Agent Team auto-generation)."""

import json
import re
import subprocess
from pathlib import Path

from ccpilot.utils import find_claude, clean_env

# ── Planning prompt ───────────────────────────────────────────────────────────

PLANNING_PROMPT = """당신은 소프트웨어 프로젝트 플래닝 전문가입니다.
주어진 프로젝트 문서를 분석하여 병렬로 작업할 Claude Code 에이전트 팀을 설계하세요.

**반드시 아래 JSON 형식으로만 응답하세요. 마크다운 코드블록, 설명 텍스트 없이 JSON만 출력:**
{
  "summary": "프로젝트 한 줄 요약",
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
- 에이전트는 2~5개 (프로젝트 규모에 맞게)
- cwd_suffix: 소문자 영문, 슬래시 없음 (예: frontend, backend, db, infra, testing)
- init_prompt: 해당 에이전트가 즉시 실행할 수 있는 구체적 태스크. 반드시 아래 두 가지를 포함:
  1) Claude Code의 /skills 명령으로 사용 가능한 스킬(notebooklm, unity-cli 등)을 적극 활용하도록 안내
  2) 복잡한 서브태스크는 Claude Code의 Agent Teams 기능(claude --agents)을 활용해 병렬 처리하도록 안내
  예시: "...구현 시 관련 /skills를 먼저 확인하고, 독립적인 모듈은 claude --agents로 서브에이전트를 활용해 병렬 작업하세요."
- phase: 항상 "inprogress"
- 프로젝트 문서가 불명확해도 합리적으로 추론해서 제안"""


def run_planning_claude(text: str, cwd: str, model: str) -> dict:
    """
    Planning Claude를 실행해 에이전트 팀 구성 JSON을 반환.
    blocking 함수 -> 스레드에서 호출.
    반환: {"summary": "...", "agents": [...]} 또는 {"error": "..."}
    """
    base = find_claude()
    if base is None:
        return {"error": "claude를 찾을 수 없습니다."}

    prompt = f"{PLANNING_PROMPT}\n\n---\n프로젝트 문서:\n{text}"

    cmd = base + [
        "--dangerously-skip-permissions",
        "--print",
        "--output-format", "stream-json",
        "--verbose",
    ]
    if model:
        cmd += ["--model", model]
    cmd += [prompt]

    try:
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=clean_env(),
            cwd=cwd,
        )
    except Exception as e:
        return {"error": str(e)}

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

    # JSON 파싱 (Claude가 마크다운으로 감쌌을 경우 대비)
    text_clean = full_text.strip()
    if text_clean.startswith("```"):
        lines = text_clean.splitlines()
        text_clean = "\n".join(l for l in lines if not l.startswith("```")).strip()

    try:
        return json.loads(text_clean)
    except Exception:
        # JSON 블록만 추출 시도
        m = re.search(r'\{[\s\S]*\}', text_clean)
        if m:
            try:
                return json.loads(m.group())
            except Exception:
                pass
        return {"error": f"JSON 파싱 실패: {text_clean[:200]}"}


def write_agents_md(root_cwd: str, summary: str, agents: list[dict]):
    """프로젝트 루트에 AGENTS.md 생성."""
    lines = ["# Agent Team\n",
             f"## 프로젝트 요약\n{summary}\n",
             "## 팀 구성\n"]
    for a in agents:
        lines.append(f"- **{a['title']}** (`{a.get('cwd_suffix','.')}`) -- {a.get('role','')}\n")
    lines += [
        "\n## 공유 규칙\n",
        "- 이 파일을 읽고 다른 에이전트의 작업 영역을 침범하지 마세요.\n",
        "- 공통 인터페이스(API 스펙, DB 스키마 등)는 이 파일에 업데이트하세요.\n",
        "- 완료한 태스크는 아래 '진행 상황' 섹션에 기록하세요.\n",
        "\n## 진행 상황\n",
        "<!-- 각 에이전트가 여기에 진행 상황을 업데이트 -->\n",
    ]
    try:
        agents_md = Path(root_cwd) / "AGENTS.md"
        agents_md.write_text("".join(lines), encoding="utf-8")
    except Exception:
        pass
