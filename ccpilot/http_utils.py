"""CCPilot -- HTTP utilities."""

import json

def json_response(writer, data: dict | list, status: int = 200, status_text: str = "OK"):
    """객체를 JSON으로 직렬화하여 HTTP 응답을 작성합니다."""
    try:
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
    except Exception as e:
        body = json.dumps({"error": str(e)}, ensure_ascii=False).encode('utf-8')
        status = 500
        status_text = "Internal Server Error"
        
    header = (
        f"HTTP/1.1 {status} {status_text}\r\n"
        f"Content-Type: application/json; charset=utf-8\r\n"
        f"Content-Length: {len(body)}\r\n"
        f"Connection: close\r\n\r\n"
    ).encode('utf-8')
    
    writer.write(header + body)

def error_response(writer, error_msg: str, status: int = 400, status_text: str = "Bad Request"):
    """에러 메시지를 JSON 형태로 반환합니다."""
    json_response(writer, {"error": error_msg}, status=status, status_text=status_text)
