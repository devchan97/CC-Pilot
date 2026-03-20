"""CCPilot -- Enhancement (Agent Team auto-generation for enhancement/optimization tasks)."""

import json
import re
import subprocess

from ccpilot.utils import build_claude_cmd, clean_env, no_window_kwargs, resolve_cwd, parse_claude_json

# ── Enhancement prompt ────────────────────────────────────────────────────────

ENHANCEMENT_PROMPT = """You are a software enhancement and optimization expert. Analyze the given service/feature description and design a Claude Code agent team to implement improvements in parallel.

**Respond ONLY in the following JSON format. Output ONLY valid JSON — no markdown code blocks, no explanatory text:**

{
  "summary": "One-line enhancement goal summary",
  "prerequisites": [
    {"label": "Item name (e.g. Profile current performance baseline)", "detail": "One-line detail or command (optional)"}
  ],
  "agents": [
    {
      "role": "performance",
      "title": "Performance Engineer",
      "cwd_suffix": "backend",
      "init_prompt": "Specific enhancement task (2-3 sentences)",
      "phase": "inprogress"
    }
  ]
}

Rules:
1. Design 2-5 agents based on enhancement scope.
2. Each agent should handle a distinct enhancement area (performance, scalability, UX, security, observability, etc.).
3. cwd_suffix is a relative sub-directory within the project root. Lowercase English, no slashes.
4. init_prompt must be specific: what to improve, measurable target, and how. Start with "Read AGENTS.md for team context."
5. prerequisites should include: performance profiling baseline, load testing setup, monitoring tools, etc.
6. summary should describe the current pain point and the target improvement.
7. Roles: performance, caching, db-optimization, scaling, ux, monitoring, security, etc.
8. init_prompt must include: 1) Check available skills with /skills. 2) For independent sub-tasks, use Task tool to parallelize.
9. Output must be valid JSON parseable by Python's json.loads()."""

KO_ENHANCEMENT_PROMPT = """당신은 소프트웨어 성능 개선 및 기능 강화 전문가입니다.
주어진 서비스/기능 설명을 분석하여 병렬로 개선 작업을 수행할 Claude Code 에이전트 팀을 설계하세요.

**반드시 아래 JSON 형식으로만 응답하세요. 마크다운 코드블록, 설명 텍스트 없이 JSON만 출력:**
{
  "summary": "개선 목표 한 줄 요약",
  "prerequisites": [
    {
      "label": "항목 이름 (예: 현재 성능 기준치 측정)",
      "detail": "확인 방법 또는 명령어 한 줄 설명 (선택)"
    }
  ],
  "agents": [
    {
      "role": "performance",
      "title": "성능 최적화",
      "cwd_suffix": "backend",
      "init_prompt": "구체적인 개선 태스크 설명 (한국어, 2-3문장)",
      "phase": "inprogress"
    }
  ]
}

규칙:
- prerequisites: 개선 전 필요한 준비 사항 (성능 프로파일링, 로드 테스트 환경, 모니터링 도구 등)
- 에이전트는 2~5개 (개선 범위에 맞게)
- cwd_suffix: 소문자 영문, 슬래시 없음
- init_prompt: 무엇을, 측정 가능한 목표치와 함께, 어떻게 개선할지 명시. 반드시 포함:
  1) AGENTS.md를 먼저 읽어 팀 컨텍스트 파악
  2) /skills 명령으로 사용 가능한 스킬 확인
  3) 독립적 서브태스크는 Task 도구로 병렬 처리
- phase: 항상 "inprogress"
- 개선 영역: 성능(performance), 캐싱(caching), DB 최적화, 스케일링, UX, 모니터링, 보안 등
- 현재 문제점과 목표 수치를 명확히 반영"""


def run_enhancement_claude(text: str, cwd: str, model: str, lang: str = 'en', images=None) -> dict:
    """
    Enhancement Claude 실행 → 에이전트 팀 구성 JSON 반환.
    blocking 함수 → 스레드에서 호출.
    """
    enhancement_prompt = KO_ENHANCEMENT_PROMPT if lang == 'ko' else ENHANCEMENT_PROMPT
    doc_label = "개선 대상 서비스/기능 설명" if lang == 'ko' else "Service/Feature Description"
    prompt = f"{enhancement_prompt}\n\n---\n{doc_label}:\n{text}"

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
