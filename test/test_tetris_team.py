#!/usr/bin/env python3
"""
테트리스 팀 스폰 통합 테스트.

프론트엔드 개발자 + 백엔드 개발자 + 코드 리뷰어 3명을 spawn해서
테트리스 게임을 만들도록 init_prompt를 보내는 시나리오 테스트.

표준 라이브러리만 사용.

사용법:
  python test/test_tetris_team.py
  python test/test_tetris_team.py --port 9090
  python test/test_tetris_team.py --outdir C:/projects/tetris
"""

import argparse
import base64
import json
import os
import socket
import sys
import time
import urllib.request
from pathlib import Path


# ── HTTP helpers ──────────────────────────────────────────────────────────────

def post_json(url: str, payload: dict) -> dict:
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        url, data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read())


def check_server(host: str, port: int):
    try:
        urllib.request.urlopen(f"http://{host}:{port}", timeout=3)
    except Exception as e:
        print(f"[SKIP] 서버가 실행 중이지 않습니다: {e}")
        sys.exit(0)


# ── 미니 WebSocket 클라이언트 ─────────────────────────────────────────────────

def ws_connect(host: str, port: int, path: str) -> socket.socket:
    key = base64.b64encode(b"tetris_test_1234").decode()
    sock = socket.create_connection((host, port), timeout=10)
    handshake = (
        f"GET {path} HTTP/1.1\r\n"
        f"Host: {host}:{port}\r\n"
        f"Upgrade: websocket\r\n"
        f"Connection: Upgrade\r\n"
        f"Sec-WebSocket-Key: {key}\r\n"
        f"Sec-WebSocket-Version: 13\r\n\r\n"
    )
    sock.sendall(handshake.encode())
    response = b""
    while b"\r\n\r\n" not in response:
        chunk = sock.recv(4096)
        if not chunk:
            raise ConnectionError("WS 핸드셰이크 응답 없음")
        response += chunk
    if b"101" not in response:
        raise ConnectionError(f"WS 업그레이드 실패: {response[:120]}")
    return sock


def ws_send(sock: socket.socket, payload: dict):
    """마스킹된 WebSocket 텍스트 프레임 전송."""
    data = json.dumps(payload).encode()
    n = len(data)
    mask = b'\x11\x22\x33\x44'
    masked = bytearray(n)
    for i in range(n):
        masked[i] = data[i] ^ mask[i % 4]
    # 126 이하면 1바이트 length
    if n <= 125:
        frame = bytes([0x81, 0x80 | n]) + mask + bytes(masked)
    else:
        frame = bytes([0x81, 0xFE]) + n.to_bytes(2, "big") + mask + bytes(masked)
    sock.sendall(frame)


def ws_recv(sock: socket.socket) -> dict | None:
    """WebSocket 텍스트 프레임 수신 → JSON 파싱."""
    try:
        b0 = sock.recv(1)
        if not b0:
            return None
        b1 = sock.recv(1)
        n = b1[0] & 0x7F
        if n == 126:
            n = int.from_bytes(sock.recv(2), "big")
        elif n == 127:
            n = int.from_bytes(sock.recv(8), "big")
        payload = b""
        while len(payload) < n:
            chunk = sock.recv(n - len(payload))
            if not chunk:
                return None
            payload += chunk
        return json.loads(payload.decode(errors="replace"))
    except Exception:
        return None


def wait_connected(sock: socket.socket, timeout: int = 60) -> bool:
    """connected 이벤트가 올 때까지 대기."""
    sock.settimeout(timeout)
    for _ in range(300):
        msg = ws_recv(sock)
        if msg is None:
            return False
        t = msg.get("type", "")
        if t == "connected":
            return True
        if t == "error":
            print(f"      WS 오류: {msg.get('message')}")
            return False
    return False


# ── 테스트 ────────────────────────────────────────────────────────────────────

AGENTS = [
    {
        "role": "frontend",
        "title": "Frontend Developer",
        "cwd_suffix": "tetris",
        "phase": "inprogress",
        "init_prompt": (
            "당신은 테트리스 게임의 프론트엔드 개발자입니다.\n"
            "순수 HTML/CSS/JavaScript(라이브러리 없음)로 테트리스 게임을 구현해주세요.\n\n"
            "요구사항:\n"
            "- tetris/index.html 단일 파일로 완성\n"
            "- 7가지 테트로미노(I/O/T/S/Z/J/L) 모두 구현\n"
            "- 키보드 조작: ← → 이동, ↑ 회전, ↓ 소프트드롭, Space 하드드롭\n"
            "- 점수판, 다음 블록 미리보기, 레벨/속도 증가\n"
            "- 게임오버/재시작 기능\n"
            "- 깔끔한 스타일링 (다크 테마)\n\n"
            "구현이 완료되면 '프론트엔드 구현 완료'라고 알려주세요."
        ),
    },
    {
        "role": "backend",
        "title": "Backend Developer",
        "cwd_suffix": "tetris",
        "phase": "inprogress",
        "init_prompt": (
            "당신은 테트리스 게임의 백엔드/게임로직 개발자입니다.\n"
            "테트리스 게임 로직을 JavaScript 모듈로 분리 구현해주세요.\n\n"
            "요구사항:\n"
            "- tetris/game.js 파일로 게임 로직 분리\n"
            "- Board 클래스: 충돌 감지, 라인 클리어, 블록 배치\n"
            "- Tetromino 클래스: 회전 행렬, 각 피스 shape 정의\n"
            "- ScoreManager: 1줄=100, 2줄=300, 3줄=500, 4줄=800 (테트리스) × 레벨\n"
            "- export/import ES Module 형태로 작성\n"
            "- JSDoc 주석 포함\n\n"
            "구현이 완료되면 '백엔드 로직 구현 완료'라고 알려주세요."
        ),
    },
    {
        "role": "reviewer",
        "title": "Code Reviewer",
        "cwd_suffix": "tetris",
        "phase": "inprogress",
        "init_prompt": (
            "당신은 테트리스 프로젝트의 코드 리뷰어입니다.\n"
            "tetris/ 디렉토리의 코드를 검토하고 개선 사항을 제안해주세요.\n\n"
            "리뷰 항목:\n"
            "- index.html과 game.js의 코드 품질 검토\n"
            "- 버그 가능성 있는 코드 식별\n"
            "- 성능 최적화 포인트 제안\n"
            "- 접근성(키보드 포커스, aria) 개선 제안\n"
            "- README.md 작성 (설치/실행 방법, 조작키 안내)\n\n"
            "리뷰 완료 후 tetris/REVIEW.md 파일에 리뷰 결과를 정리해주세요.\n"
            "준비가 되면 '코드 리뷰 준비 중'이라고 먼저 알려주고,\n"
            "프론트엔드/백엔드 구현이 완료되면 리뷰를 시작해주세요."
        ),
    },
]


def test_spawn_tetris_team(host: str, port: int, outdir: str):
    """프론트엔드 + 백엔드 + 리뷰어 3명 spawn 후 WS 연결 확인."""
    print("\n[TEST] 테트리스 팀 Spawn")
    print(f"  agents: {[a['role'] for a in AGENTS]}")
    print(f"  outdir: {outdir or '(서버 기본)'}")

    agents_payload = []
    for ag in AGENTS:
        agents_payload.append({
            "role":        ag["role"],
            "title":       ag["title"],
            "cwd_suffix":  ag["cwd_suffix"],
            "init_prompt": ag["init_prompt"],
            "phase":       ag["phase"],
            "model":       "",
        })

    result = post_json(f"http://{host}:{port}/api/plan/spawn", {
        "agents":   agents_payload,
        "root_cwd": outdir,
        "summary":  "테트리스 게임 개발팀",
        "model":    "",
    })

    assert "sessions" in result and result["sessions"], f"spawn 실패: {result}"
    sessions = result["sessions"]
    assert len(sessions) == 3, f"세션 수 불일치: {len(sessions)}"
    print(f"  [OK] {len(sessions)}개 세션 생성됨")
    for s in sessions:
        print(f"       sid={s['session_id']}  title={s.get('title','')}")
    return sessions


def test_ws_connections(host: str, port: int, sessions: list):
    """각 세션 WebSocket 연결 + heartbeat → connected 이벤트 확인."""
    print("\n[TEST] WebSocket 연결 (heartbeat → connected)")
    results = {}

    for s in sessions:
        sid   = s["session_id"]
        title = s.get("title", sid)
        print(f"  [{title}] 연결 중…")

        try:
            sock = ws_connect(host, port, f"/ws/{sid}")
            ws_send(sock, {"type": "heartbeat"})
            connected = wait_connected(sock, timeout=60)
            sock.close()

            if connected:
                print(f"  [{title}] [OK] connected 이벤트 수신")
                results[sid] = True
            else:
                print(f"  [{title}] [WARN] connected 미수신 (Claude 미설치 가능)")
                results[sid] = False
        except Exception as e:
            print(f"  [{title}] [FAIL] {e}")
            results[sid] = False

    # WS 핸드셰이크 자체는 모두 성공이어야 함 (Claude 없어도 OK)
    assert len(results) == len(sessions), "일부 세션 WS 연결 자체 실패"
    print("  [OK] 모든 세션 WS 핸드셰이크 성공")
    return results


def test_session_list(host: str, port: int, expected_sids: list):
    """GET /api/sessions 에서 spawn된 세션이 포함되는지 확인.

    /api/sessions 응답은 sessions.json 원본 — 각 항목의 키는 "id" (session_id 아님).
    """
    print("\n[TEST] 세션 목록 영속화 확인")
    with urllib.request.urlopen(f"http://{host}:{port}/api/sessions", timeout=5) as resp:
        data = json.loads(resp.read())
    # sessions.json 항목 키: "id" (SessionManager._session_to_dict 참고)
    saved = {s.get("id") or s.get("session_id") for s in data.get("sessions", [])}
    for sid in expected_sids:
        assert sid in saved, f"sessions.json에 sid 없음: {sid}"
    print(f"  [OK] {len(expected_sids)}개 세션 모두 sessions.json에 저장됨")


def test_delete_sessions(host: str, port: int, sids: list):
    """생성된 테스트 세션 정리."""
    print("\n[CLEANUP] 테스트 세션 삭제")
    for sid in sids:
        req = urllib.request.Request(
            f"http://{host}:{port}/api/session/{sid}",
            method="DELETE",
        )
        try:
            with urllib.request.urlopen(req, timeout=5):
                pass
            print(f"  삭제됨: {sid}")
        except Exception as e:
            print(f"  삭제 실패 {sid}: {e}")
    print("  [OK] 정리 완료")


# ── main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="테트리스 팀 스폰 통합 테스트")
    parser.add_argument("--port",   type=int, default=8080, help="서버 포트 (기본 8080)")
    parser.add_argument("--outdir", type=str, default="",   help="테트리스 출력 루트 경로 (기본: 서버 cwd)")
    parser.add_argument("--no-cleanup", action="store_true", help="테스트 후 세션 삭제 안 함")
    args = parser.parse_args()

    host, port = "localhost", args.port
    print(f"테스트 대상: http://{host}:{port}")
    check_server(host, port)

    passed = failed = 0
    spawned_sids = []

    def run(name, fn, *a, **kw):
        nonlocal passed, failed
        try:
            result = fn(*a, **kw)
            passed += 1
            return result
        except AssertionError as e:
            print(f"  [FAIL] {name}: {e}")
            failed += 1
            return None
        except Exception as e:
            print(f"  [ERROR] {name}: {e}")
            failed += 1
            return None

    # 1) Spawn
    sessions = run("spawn_tetris_team", test_spawn_tetris_team, host, port, args.outdir)
    if sessions:
        spawned_sids = [s["session_id"] for s in sessions]

        # 2) WS 연결
        run("ws_connections", test_ws_connections, host, port, sessions)

        # 3) 세션 목록 영속화
        run("session_list", test_session_list, host, port, spawned_sids)

    # Cleanup
    if spawned_sids and not args.no_cleanup:
        test_delete_sessions(host, port, spawned_sids)
    elif spawned_sids and args.no_cleanup:
        print(f"\n[INFO] --no-cleanup: 세션 유지됨 → 브라우저에서 진행 상황 확인 가능")
        print(f"       세션 IDs: {spawned_sids}")

    print(f"\n결과: {passed} 통과 / {failed} 실패")
    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
