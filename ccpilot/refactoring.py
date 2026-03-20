"""CCPilot -- Refactoring (Agent Team auto-generation for refactoring tasks)."""

import json
import re
import subprocess

from ccpilot.utils import build_claude_cmd, clean_env, no_window_kwargs, resolve_cwd, parse_claude_json

# ── Refactoring prompt ────────────────────────────────────────────────────────

REFACTORING_PROMPT = """You are a software refactoring expert. Analyze the given codebase description and design a Claude Code agent team to perform the refactoring in parallel.

**Respond ONLY in the following JSON format. Output ONLY valid JSON — no markdown code blocks, no explanatory text:**

{
  "summary": "One-line refactoring goal summary",
  "prerequisites": [
    {"label": "Item name (e.g. Run existing tests first)", "detail": "One-line detail or command (optional)"}
  ],
  "agents": [
    {
      "role": "backend",
      "title": "Backend Refactor",
      "cwd_suffix": "backend",
      "init_prompt": "Specific refactoring task (2-3 sentences)",
      "phase": "inprogress"
    }
  ]
}

Rules:
1. Design 2-5 agents based on refactoring scope.
2. Each agent should handle an independent module or layer for safe parallel refactoring.
3. cwd_suffix is a relative sub-directory within the project root. Lowercase English, no slashes.
4. init_prompt must be specific: what to refactor, how, and what to preserve. Start with "Read AGENTS.md for team context."
5. prerequisites should include: running existing tests, backing up config files, or required tools.
6. summary should describe what is being refactored and the target state.
7. Roles: use descriptive names like api-layer, data-layer, ui-components, infra, tests.
8. init_prompt must include: 1) Check available skills with /skills. 2) For independent sub-modules, use Task tool to parallelize.
9. Output must be valid JSON parseable by Python's json.loads()."""

KO_REFACTORING_PROMPT = """당신은 소프트웨어 리팩토링 전문가입니다.
주어진 코드베이스 설명을 분석하여 병렬로 리팩토링을 수행할 Claude Code 에이전트 팀을 설계하세요.

**반드시 아래 JSON 형식으로만 응답하세요. 마크다운 코드블록, 설명 텍스트 없이 JSON만 출력:**
{
  "summary": "리팩토링 목표 한 줄 요약",
  "prerequisites": [
    {
      "label": "항목 이름 (예: 기존 테스트 실행 확인)",
      "detail": "확인 방법 또는 명령어 한 줄 설명 (선택)"
    }
  ],
  "agents": [
    {
      "role": "backend",
      "title": "백엔드 리팩토링",
      "cwd_suffix": "backend",
      "init_prompt": "구체적인 리팩토링 태스크 설명 (한국어, 2-3문장)",
      "phase": "inprogress"
    }
  ]
}

규칙:
- prerequisites: 리팩토링 전 확인해야 할 항목 (기존 테스트 통과 확인, 백업, 필요 도구 등)
- 에이전트는 2~5개 (리팩토링 범위에 맞게)
- cwd_suffix: 소문자 영문, 슬래시 없음 (예: api-layer, ui, tests, infra)
- init_prompt: 무엇을, 어떻게, 무엇을 보존하며 리팩토링할지 구체적으로 명시. 반드시 포함:
  1) AGENTS.md를 먼저 읽어 팀 컨텍스트 파악
  2) /skills 명령으로 사용 가능한 스킬 확인
  3) 독립적 서브태스크는 Task 도구로 병렬 처리
- phase: 항상 "inprogress"
- 기존 기능이 유지되도록 점진적 리팩토링 전략 반영"""


def run_refactoring_claude(text: str, cwd: str, model: str, lang: str = 'en', images=None) -> dict:
    """
    Refactoring Claude 실행 → 에이전트 팀 구성 JSON 반환.
    blocking 함수 → 스레드에서 호출.
    """
    refactoring_prompt = KO_REFACTORING_PROMPT if lang == 'ko' else REFACTORING_PROMPT
    doc_label = "리팩토링 대상 코드베이스 설명" if lang == 'ko' else "Codebase Description"
    prompt = f"{refactoring_prompt}\n\n---\n{doc_label}:\n{text}"

    cmd = build_claude_cmd(model=model)
    if not cmd:
        return {"error": "claude를 찾을 수 없습니다."}
    cmd += [prompt]

    try:
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=clean_env(),
            cwd=resolve_cwd(cwd) if cwd else None,
            **no_window_kwargs(),
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
            ev_type = ev.get("type", "")
            if ev_type == "assistant":
                for block in (ev.get("message") or {}).get("content", []):
                    if block.get("type") == "text":
                        full_text += block["text"]
            elif ev_type == "result":
                result_text = ev.get("result", "")
                if result_text and not full_text:
                    full_text = result_text
    except Exception:
        pass

    proc.wait()

    return parse_claude_json(full_text)
