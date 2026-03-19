# 테스트

## 사전 조건

서버가 실행 중이어야 합니다:
```
py webui.py
```

## 테스트 파일

| 파일 | 설명 |
|------|------|
| `sample_prd.md` | 쇼핑몰 PRD 샘플 (텍스트/파일 업로드 테스트용) |
| `test_plan_api.py` | `/api/plan/*` API 단위 테스트 |
| `test_spawn_flow.py` | Spawn + WebSocket 통합 테스트 |

## 실행

```bash
# API 단위 테스트 (Claude 실제 호출 포함 — 시간 소요)
python test/test_plan_api.py

# WS 통합 테스트
python test/test_spawn_flow.py

# 포트 변경 시
python test/test_plan_api.py --port 9090
```

## 테스트 항목

### test_plan_api.py
- `plan/text` 빈 텍스트 → 400
- `plan/text` PRD 입력 → agents JSON 반환
- `plan/file` .md 업로드 → agents JSON 반환
- `plan/spawn` → session_id 반환

### test_spawn_flow.py
- 존재하지 않는 sid → WS 404
- spawn → WS 연결 → heartbeat → connected 이벤트
