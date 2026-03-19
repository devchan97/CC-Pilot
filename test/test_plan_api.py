#!/usr/bin/env python3
"""
/api/plan/* API 단위 테스트
표준 라이브러리(urllib)만 사용.

사전 조건: py webui.py 실행 중이어야 함 (기본 포트 8080)

사용법:
  python test/test_plan_api.py
  python test/test_plan_api.py --port 9090
"""

import argparse
import json
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path


def post_json(url: str, payload: dict) -> dict:
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read())


def post_multipart(url: str, file_path: str, cwd: str = "", model: str = "") -> dict:
    """단순 multipart/form-data 전송."""
    boundary = "----TestBoundary1234567890"
    file_bytes = Path(file_path).read_bytes()
    filename = Path(file_path).name

    parts = []
    # file 필드
    parts.append(
        f'--{boundary}\r\n'
        f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'
        f'Content-Type: text/plain\r\n\r\n'.encode()
        + file_bytes + b'\r\n'
    )
    # cwd 필드
    parts.append(
        f'--{boundary}\r\nContent-Disposition: form-data; name="cwd"\r\n\r\n{cwd}\r\n'.encode()
    )
    # model 필드
    parts.append(
        f'--{boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\n{model}\r\n'.encode()
    )
    parts.append(f'--{boundary}--\r\n'.encode())

    body = b''.join(parts)
    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read())


def check_server(base_url: str):
    try:
        urllib.request.urlopen(base_url, timeout=3)
    except Exception as e:
        print(f"[SKIP] 서버가 실행중이지 않습니다: {e}")
        sys.exit(0)


def validate_agents(agents: list, test_name: str):
    assert isinstance(agents, list), f"{test_name}: agents가 리스트여야 함"
    assert len(agents) >= 1, f"{test_name}: 에이전트가 1개 이상이어야 함"
    for ag in agents:
        assert "role"        in ag, f"{test_name}: role 필드 누락"
        assert "title"       in ag, f"{test_name}: title 필드 누락"
        assert "cwd_suffix"  in ag, f"{test_name}: cwd_suffix 필드 누락"
        assert "init_prompt" in ag, f"{test_name}: init_prompt 필드 누락"
    print(f"  [OK] {len(agents)}개 에이전트: {[a['role'] for a in agents]}")


def test_plan_text(base_url: str):
    print("\n[TEST] POST /api/plan/text — 텍스트 입력")
    sample = Path(__file__).parent / "sample_prd.md"
    text = sample.read_text(encoding="utf-8")

    result = post_json(f"{base_url}/api/plan/text", {"text": text, "cwd": "", "model": ""})
    assert "error" not in result, f"오류 응답: {result.get('error')}"
    assert "agents" in result, "agents 키 누락"
    validate_agents(result["agents"], "plan/text")
    print(f"  [OK] 요약: {result.get('summary','(없음)')[:60]}")


def test_plan_text_empty(base_url: str):
    print("\n[TEST] POST /api/plan/text — 빈 텍스트 → 400")
    req = urllib.request.Request(
        f"{base_url}/api/plan/text",
        data=b'{"text":"","cwd":"","model":""}',
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        urllib.request.urlopen(req, timeout=10)
        print("  [FAIL] 400을 기대했으나 200 반환")
    except urllib.error.HTTPError as e:
        assert e.code == 400, f"400 기대, {e.code} 반환"
        print("  [OK] 400 Bad Request 정상 반환")


def test_plan_file(base_url: str):
    print("\n[TEST] POST /api/plan/file — 파일 업로드")
    sample = Path(__file__).parent / "sample_prd.md"
    result = post_multipart(f"{base_url}/api/plan/file", str(sample))
    assert "error" not in result, f"오류 응답: {result.get('error')}"
    assert "agents" in result, "agents 키 누락"
    validate_agents(result["agents"], "plan/file")


def test_plan_spawn(base_url: str):
    print("\n[TEST] POST /api/plan/spawn — 에이전트 spawn")
    sample_agents = [
        {"role":"frontend","title":"Frontend Dev","cwd_suffix":"","init_prompt":"안녕하세요","phase":"inprogress"},
        {"role":"backend","title":"Backend Dev","cwd_suffix":"","init_prompt":"안녕하세요","phase":"inprogress"},
    ]
    result = post_json(f"{base_url}/api/plan/spawn", {
        "agents": sample_agents,
        "root_cwd": "",
        "summary": "테스트 프로젝트",
        "model": "",
    })
    assert "sessions" in result, "sessions 키 누락"
    assert len(result["sessions"]) == 2, f"세션 2개 기대, {len(result['sessions'])}개"
    for s in result["sessions"]:
        assert "session_id" in s, "session_id 누락"
        assert "role" in s, "role 누락"
    sids = [s["session_id"] for s in result["sessions"]]
    print(f"  [OK] 생성된 session_id: {sids}")
    return sids


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8080)
    args = parser.parse_args()

    base_url = f"http://localhost:{args.port}"
    print(f"테스트 대상: {base_url}")
    check_server(base_url)

    passed = failed = 0
    for fn in [test_plan_text_empty, test_plan_text, test_plan_file, test_plan_spawn]:
        try:
            fn(base_url)
            passed += 1
        except Exception as e:
            print(f"  [FAIL] {fn.__name__}: {e}")
            failed += 1

    print(f"\n결과: {passed} 통과 / {failed} 실패")
    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
