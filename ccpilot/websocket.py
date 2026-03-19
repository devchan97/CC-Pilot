"""CCPilot -- WebSocket implementation."""

import asyncio
import base64
import hashlib
import json
import threading

from ccpilot.session import MGR

# ── WebSocket 구현 ────────────────────────────────────────────────────────────

WS_MAGIC = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"


async def ws_handshake(reader, writer, headers_raw):
    key = ""
    for line in headers_raw.split("\r\n"):
        if line.lower().startswith("sec-websocket-key:"):
            key = line.split(":", 1)[1].strip()
    accept = base64.b64encode(hashlib.sha1((key + WS_MAGIC).encode()).digest()).decode()
    writer.write(
        b"HTTP/1.1 101 Switching Protocols\r\n"
        b"Upgrade: websocket\r\nConnection: Upgrade\r\n"
        b"Sec-WebSocket-Accept: " + accept.encode() + b"\r\n\r\n"
    )
    await writer.drain()


async def ws_recv(reader) -> str | None:
    try:
        b0, b1 = await reader.readexactly(2)
        if b0 & 0x0F == 0x8: return None
        masked = bool(b1 & 0x80)
        n = b1 & 0x7F
        if n == 126: n = int.from_bytes(await reader.readexactly(2), "big")
        elif n == 127: n = int.from_bytes(await reader.readexactly(8), "big")
        mask = await reader.readexactly(4) if masked else b"\x00\x00\x00\x00"
        pay = bytearray(await reader.readexactly(n))
        if masked:
            for i in range(len(pay)): pay[i] ^= mask[i % 4]
        return pay.decode(errors="replace")
    except Exception:
        return None


async def ws_send(writer, text: str):
    pay = text.encode()
    n = len(pay)
    hdr = bytearray([0x81])
    if n < 126: hdr.append(n)
    elif n < 65536: hdr += bytearray([126]) + n.to_bytes(2, "big")
    else: hdr += bytearray([127]) + n.to_bytes(8, "big")
    writer.write(bytes(hdr) + pay)
    await writer.drain()


async def ws_handler(reader, writer, head_str, sid: str):
    await ws_handshake(reader, writer, head_str)
    q = MGR.subscribe(sid)

    async def sender():
        while True:
            data = await q.get()
            try: await ws_send(writer, data)
            except Exception: break

    task = asyncio.ensure_future(sender())
    try:
        while True:
            raw = await ws_recv(reader)
            if raw is None: break
            try: m = json.loads(raw)
            except Exception: continue

            t = m.get("type")
            if t == "heartbeat":
                # Claude에 히든 ping 전송 -> 응답 받으면 connected 발행
                threading.Thread(
                    target=MGR.heartbeat, args=(sid,), daemon=True
                ).start()
            elif t == "input":
                MGR.send(sid, m.get("data", ""))
            elif t == "clear":
                MGR.clear(sid)
            elif t == "stop":
                MGR.stop(sid)
    except Exception:
        pass
    finally:
        task.cancel()
        MGR.unsubscribe(sid, q)
        writer.close()
