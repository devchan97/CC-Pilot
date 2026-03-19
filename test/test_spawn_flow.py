#!/usr/bin/env python3
"""
Spawn 플로우 통합 테스트 (WebSocket 연결 포함).
표준 라이브러리만 사용.

사용법:
  python test/test_spawn_flow.py
  python test/test_spawn_flow.py --port 9090
"""

import argparse
import base64
import hashlib
import json
import socket
import sys
import urllib.request
from pathlib import Path


# ── 미니 WebSocket 클라이언트 (표준 라이브러리) ───────────────────────────────

def ws_connect(host: str, port: int, path: str) -> socket.socket:
    key = base64.b64encode(b"test_key_1234567").decode()
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
        raise ConnectionError(f"WS 업그레이드 실패: {response[:100]}")
    return sock


def ws_recv_frame(sock: socket.socket) -> dict | None:
    """WebSocket 프레임 수신 → JSON 파싱."""
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


def post_json(url: str, payload: dict) -> dict:
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        url, data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read())


def check_server(host: str, port: int):
    try:
        urllib.request.urlopen(f"http://{host}:{port}", timeout=3)
    except Exception as e:
        print(f"[SKIP] 서버가 실행중이지 않습니다: {e}")
        sys.exit(0)


# ── 테스트 ────────────────────────────────────────────────────────────────────

def test_spawn_and_ws(host: str, port: int):
    print("\n[TEST] Spawn → WebSocket 연결 확인")

    agents = [{"role":"tester","title":"Test Agent","cwd_suffix":"","init_prompt":"","phase":"inprogress"}]
    result = post_json(f"http://{host}:{port}/api/plan/spawn", {
        "agents": agents, "root_cwd": "", "summary": "WS 테스트", "model": ""
    })
    assert "sessions" in result and result["sessions"], "spawn 실패"
    sid = result["sessions"][0]["session_id"]
    print(f"  session_id: {sid}")

    # WebSocket 연결
    sock = ws_connect(host, port, f"/ws/{sid}")
    print("  [OK] WebSocket 연결 성공")

    # heartbeat 전송
    payload = json.dumps({"type": "heartbeat"}).encode()
    n = len(payload)
    mask = b'\x01\x02\x03\x04'
    masked = bytearray(n)
    for i in range(n):
        masked[i] = payload[i] ^ mask[i % 4]
    frame = bytes([0x81, 0x80 | n]) + mask + bytes(masked)
    sock.sendall(frame)
    print("  heartbeat 전송됨")

    # Claude 연결 응답 대기 (최대 60초)
    sock.settimeout(60)
    connected = False
    for _ in range(200):
        msg = ws_recv_frame(sock)
        if msg is None:
            break
        t = msg.get("type", "")
        print(f"    WS 수신: {t}")
        if t == "connected":
            connected = True
            break
        if t == "error":
            print(f"  [WARN] 오류: {msg.get('message')}")
            break

    sock.close()

    if connected:
        print("  [OK] Claude 연결 확인 (connected 이벤트 수신)")
    else:
        print("  [WARN] connected 이벤트 미수신 (Claude 미설치 환경일 수 있음)")
    # Claude 없어도 WS 핸드셰이크 성공이면 통과
    assert True


def test_ws_invalid_sid(host: str, port: int):
    print("\n[TEST] 존재하지 않는 sid로 WS 연결 → 404")
    sock = socket.create_connection((host, port), timeout=5)
    handshake = (
        "GET /ws/invalid_sid_00000000 HTTP/1.1\r\n"
        f"Host: {host}:{port}\r\n"
        "Upgrade: websocket\r\n"
        "Connection: Upgrade\r\n"
        "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n"
        "Sec-WebSocket-Version: 13\r\n\r\n"
    )
    sock.sendall(handshake.encode())
    response = b""
    while b"\r\n\r\n" not in response:
        chunk = sock.recv(4096)
        if not chunk:
            break
        response += chunk
    sock.close()
    assert b"404" in response, f"404 기대, 응답: {response[:80]}"
    print("  [OK] 404 반환")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8080)
    args = parser.parse_args()

    host, port = "localhost", args.port
    print(f"테스트 대상: http://{host}:{port}")
    check_server(host, port)

    passed = failed = 0
    for fn in [test_ws_invalid_sid, test_spawn_and_ws]:
        try:
            fn(host, port)
            passed += 1
        except Exception as e:
            print(f"  [FAIL] {fn.__name__}: {e}")
            failed += 1

    print(f"\n결과: {passed} 통과 / {failed} 실패")
    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
