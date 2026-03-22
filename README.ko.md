# CCPilot

**[English](README.md)**

브라우저에서 여러 Claude Code CLI 인스턴스를 제어하는 칸반보드 기반 에이전트 팀 관리 WebUI.

[![Python 3.11+](https://img.shields.io/badge/Python-3.11+-3776ab?logo=python&logoColor=white)](https://python.org)
[![No dependencies](https://img.shields.io/badge/dependencies-none-brightgreen)](https://github.com/devchan97/CC-Pilot)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)](https://github.com/devchan97/CC-Pilot)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> PRD나 설명을 입력하면 Claude가 에이전트 팀 구성을 설계하고, CCPilot이 Claude Code 인스턴스를 스폰해 칸반보드에서 실시간으로 추적합니다.

![CCPilot 스크린샷](public/main.png)

---

## 왜 CCPilot인가?

Claude API는 긴 컨텍스트 세션을 여러 개 돌리면 비용이 금방 불어납니다. **CCPilot은 Claude를 저렴하게 쓰기 위해 만들었습니다** — API를 직접 호출하는 대신, 구독 요금제(Claude Pro/Max)로 동작하는 Claude Code CLI를 서브프로세스로 구동합니다.

토큰당 과금 대신 CCPilot은:

- 여러 개의 `claude` CLI 서브프로세스를 동시에 실행 — 각각이 하나의 칸반 카드에 대응
- 기존 Claude 구독 로그인(`~/.claude/`)을 그대로 재사용
- 세션을 병렬로 실행해 멀티스레드 API 호출처럼 동작 — 토큰 비용 없이

결과: 매달 정액 구독료만으로 API 수준의 멀티에이전트 오케스트레이션을 사용할 수 있습니다.

---

## 사전 준비사항

CCPilot을 실행하기 전에 아래 **세 가지**를 모두 설치·설정해야 합니다.

### 1. Python 3.11+

[python.org](https://www.python.org/downloads/)에서 다운로드 후 확인:

```bash
python --version   # 3.11 이상이어야 함
```

> **Windows**: 설치 시 **"Add Python to PATH"** 체크박스를 반드시 선택하세요.

### 2. Node.js + Claude Code CLI

Claude Code CLI는 npm 패키지로 배포되며 Node.js가 필요합니다.

**Step 1 — Node.js 18+ 설치**

[nodejs.org](https://nodejs.org/)에서 LTS 버전을 다운로드합니다.

```bash
node --version   # 18.x 이상
npm --version
```

**Step 2 — Claude Code 전역 설치**

```bash
npm install -g @anthropic-ai/claude-code
```

설치 확인:

```bash
claude --version
```

> **Windows 경로 주의**: Claude Code는 `%APPDATA%\npm\`에 설치됩니다. 설치 후 `claude` 명령을 찾지 못하면 `%APPDATA%\npm`을 시스템 `PATH` 환경변수에 추가하세요.

### 3. Claude Code 로그인

CCPilot은 Claude Code를 서브프로세스로 실행하며, 기존 Claude Code 로그인을 그대로 재사용합니다. 별도 API 키 설정은 필요 없습니다.

Claude Code를 한 번 실행해 로그인합니다:

```bash
claude
```

안내에 따라 Anthropic 계정으로 로그인합니다. 자격증명은 `~/.claude/`에 저장되며 CCPilot이 자동으로 재사용합니다.

정상 동작 확인:

```bash
claude -p "hello"
```

---

## 빠른 시작

```bash
git clone https://github.com/devchan97/CC-Pilot
cd CC-Pilot
python main.py
```

`http://localhost:8080`이 자동으로 열립니다.

```bash
# 포트 지정
python main.py --port 9000

# 앱 창 대신 시스템 브라우저로 열기
python main.py --browser

# 네이티브 앱 창에서 DevTools 활성화
python main.py --debug

# 전체화면으로 시작
python main.py --fullscreen
```

> **네이티브 앱 창**은 `pywebview`가 필요합니다. 설치되지 않은 경우 자동으로 시스템 브라우저로 전환됩니다.

---

## ⚠️ 위험 권한 설정 — 사용 전 반드시 읽으세요

CCPilot은 기본적으로 모든 Claude Code 세션을 `--dangerously-skip-permissions` 플래그와 함께 실행합니다. 이는 **Claude가 파일 편집, 셸 명령 실행, 웹 요청 등 모든 도구를 확인 없이 즉시 실행**한다는 의미입니다.

> **이 플래그 사용으로 인해 발생하는 모든 결과에 대한 책임은 전적으로 사용자 본인에게 있습니다.**
> 의도치 않은 파일 수정, 데이터 손실, 파괴적 명령 실행 등 Claude가 자율적으로 수행하는 모든 작업의 부작용을 포함합니다.
> CCPilot은 자신이 통제할 수 있는 환경에서, 버전 관리 또는 복구 가능한 파일에 대해서만 사용하세요.

이 플래그는 자동화 에이전트 워크플로를 위한 의도적 설계입니다 — 태스크를 지시하면 Claude가 자율적으로 실행합니다. 위험을 인지하고 수용하는 개발자를 위한 도구입니다.

기본 **인터랙티브 권한 확인 프롬프트**를 사용하려면 `ccpilot/session.py`에서 해당 플래그를 제거하거나 주석 처리하세요:

```python
# ccpilot/session.py  ·  Session.send()
cmd = base + [
    "--dangerously-skip-permissions",   # ← 이 줄을 제거하면 프롬프트가 다시 활성화됨
    "--print",
    "--output-format", "stream-json",
    "--verbose",
]
```

> **주의**: 플래그를 제거하면 Claude가 모든 도구 사용 시 일시 중지합니다. CCPilot은 WebSocket으로 출력을 스트리밍하므로 해당 프롬프트가 UI에 표시되지 않아 세션이 멈춘 것처럼 보입니다. 감독 환경 또는 샌드박스 환경에서만 플래그를 제거하세요.

> **예정된 기능**: 작업 디렉토리별 샌드박스 격리가 로드맵에 포함되어 있습니다 — 각 에이전트가 지정된 작업 디렉토리 밖으로 접근하지 못하도록 제한하는 기능을 구현할 예정입니다.

---

## 에이전트 팀 설정

### 자동 생성 (권장)

1. CCPilot을 열고 **홈** 화면으로 이동합니다.
2. 모드를 선택합니다: **Plan** (신규 프로젝트), **Refactor** (기존 코드베이스), **Enhance** (성능 개선).
3. 텍스트 박스에 PRD, 요구사항 문서, 또는 프로젝트 설명을 붙여넣습니다. 파일이나 디자인 이미지를 첨부할 수도 있습니다.
4. **전송(↑)** 버튼을 클릭하거나 `Ctrl+Enter`를 누릅니다.
5. Claude가 입력을 분석해 역할, 작업 디렉토리, 초기 프롬프트를 포함한 에이전트 팀을 제안합니다.
6. 제안을 검토하고 필요 시 에이전트 이름/모델/경로를 조정한 후 **승인 & Spawn**을 클릭합니다.
7. 모든 에이전트는 **Backlog** 카드로 생성됩니다. **In Progress**로 이동하면 실행이 시작됩니다.

### 수동 생성

1. 왼쪽 사이드바에서 **프로젝트**를 선택하거나 생성합니다.
2. 우측 상단의 **+ Task** 또는 컬럼 하단의 **+ 태스크 추가**를 클릭합니다.
3. 태스크 이름, 작업 디렉토리, 모델, 초기 메시지를 입력합니다.
4. 선택한 단계에서 세션이 시작됩니다.

### 팀 플래닝 패널 (kanban 화면 내)

상단 바의 **⚡ Auto-generate Team**을 클릭하면 보드를 벗어나지 않고 플래닝 패널을 열 수 있습니다.
텍스트를 붙여넣거나 `.md`/`.txt` 파일을 업로드해 플래너를 실행할 수 있습니다.

### 에이전트 초기 프롬프트 팁

- 초기 프롬프트는 세션이 연결되면 자동 전송됩니다 (Backlog → In Progress 이동 시 포함).
- 프로젝트 루트의 `AGENTS.md`를 참조하세요 — 플래너가 자동 생성하며 전체 팀 컨텍스트가 포함됩니다.
- 병렬 작업을 위한 권장 패턴:

```
AGENTS.md를 읽어 전체 팀 컨텍스트를 파악하세요.
당신의 역할: [역할 설명]
작업 디렉토리: [경로]

즉시 시작하세요. 독립적인 서브모듈은 `claude --agents`로 병렬 처리하세요.
가능한 도구를 확인하려면 먼저 /skills를 확인하세요.
```

---

## 플랫폼별 설치 안내

### Windows

- Python: [python.org](https://www.python.org/downloads/) — **"Add Python to PATH"** 필수 체크
- Node.js: [nodejs.org](https://nodejs.org/)
- `npm install -g @anthropic-ai/claude-code` 후 `claude`가 인식 안 되면 `%APPDATA%\npm`을 PATH에 추가
- `python main.py`를 명령 프롬프트 또는 PowerShell에서 실행 (더블클릭 실행 X)

### macOS

```bash
brew install python node
npm install -g @anthropic-ai/claude-code
```

### Linux (Ubuntu/Debian)

```bash
sudo apt install python3 nodejs npm
npm install -g @anthropic-ai/claude-code
```

---

## 주요 기능

- **세 가지 플래닝 모드** — Plan (신규 프로젝트), Refactor (기존 코드베이스), Enhance (성능 개선) — 각각 전용 프롬프트 사용
- **디자인 파일 업로드** — 스폰 모달에 이미지(PNG/JPG/WebP)와 문서(MD/TXT/JSON) 첨부 가능; 파일은 `design/`에 저장되어 에이전트 프롬프트에 경로가 포함됨
- **EN / KO 언어 전환** — UI 언어를 언제든 전환; 설정은 localStorage에 저장
- **에이전트 팀 자동 생성** — PRD 붙여넣기 또는 파일 업로드 시 Claude가 팀 구조를 설계하고 에이전트를 자동 스폰
- **다중 세션 칸반** — 여러 Claude Code 인스턴스를 Backlog / In Progress / Done 카드로 관리
- **실시간 스트리밍** — WebSocket 기반 출력 (`thinking`, `tool_use`, 토큰/비용 추적 포함)
- **메시지 큐** — 에이전트가 작업 중일 때 전송한 메시지는 큐에 쌓이고 응답 완료 후 자동 전송; 카드 뱃지와 상세 모달에서 큐 상태 확인 및 삭제 가능
- **`/model` 인라인 모델 전환** — 입력창에 `/model` 입력 시 인라인 선택 UI 표시 (Opus 4.6 / Sonnet 4.6 / Haiku 4.5); `/model <이름>`으로 직접 전환, 즉시 저장
- **세션 영속화** — `--resume`으로 재시작 후에도 세션 복원, SQLite(`ccpilot.db`)에 저장, 다음 실행 시 자동 복원
- **사용량 한도 감지** — Claude 플랜/Rate Limit 에러 감지, 대기 모드 진입, UI에 리셋 시간 표시
- **휴지통 / 복원** — 실수로 닫은 카드를 사이드바 휴지통에서 복구 (채팅 로그 포함)
- **커스텀 확인 다이얼로그** — 모든 파괴적 작업에 브라우저 `alert()` 대신 인앱 모달 사용
- **내장 파일 탐색기** — 사이드바에서 작업 디렉토리 탐색 및 선택
- **OS 폴더 다이얼로그** — Explorer 툴바의 📁 폴더 탐색을 클릭하면 네이티브 폴더 선택기가 열림
- **자동 컴팩트** — 컨텍스트 창 한도 도달 시 자동 압축, 작업 자동 재개
- **57개 퀵스타트 템플릿** — 스택 변형 옵션이 있는 프로젝트 템플릿 셔플 캐러셀
- **전체화면 모드** — `--fullscreen`으로 실행 시 전체화면 시작
- **순수 표준 라이브러리** — 런타임에 pip 설치 불필요

---

## 동작 원리

```
브라우저 (WebUI)
     │  WebSocket / HTTP
     ▼
main.py  ──►  ccpilot/routes.py      (HTTP 라우터)
              ccpilot/websocket.py   (WS 프로토콜)
              ccpilot/session.py     (Claude CLI 서브프로세스)
              ccpilot/planning.py    (에이전트 팀 설계 — Plan 모드)
              ccpilot/refactoring.py (에이전트 팀 설계 — Refactor 모드)
              ccpilot/enhancement.py (에이전트 팀 설계 — Enhance 모드)
              ccpilot/projects.py    (프로젝트 관리)
              ccpilot/db.py          (SQLite 영속화)
                    │
                    ▼
              claude --dangerously-skip-permissions --resume <session-id>
```

각 칸반 카드는 하나의 Claude Code 서브프로세스에 대응합니다. 서버는 JSON 출력을 스트리밍해 WebSocket으로 브라우저에 실시간 전달합니다.

종료(창 닫기, Ctrl+C, SIGTERM) 시 CCPilot은 모든 Claude 서브프로세스를 병렬로 종료한 뒤 프로그램을 정상 종료합니다.

---

## 프로젝트 구조

```
cc-pilot/
├── main.py                 # 진입점 (시그널 처리, 안전 종료)
├── ccpilot/                # 백엔드 패키지 (순수 표준 라이브러리)
│   ├── utils.py            # 정적 서빙, 경로 처리, Claude 탐색
│   ├── types.py            # EventType 상수
│   ├── db.py               # SQLite 영속화 (JSON 자동 마이그레이션)
│   ├── http_utils.py       # json_response / error_response 헬퍼
│   ├── session.py          # 세션 라이프사이클 + SessionManager
│   ├── projects.py         # 프로젝트 CRUD
│   ├── planning.py         # LLM 에이전트 팀 플래닝 (Plan 모드)
│   ├── refactoring.py      # LLM 에이전트 팀 플래닝 (Refactor 모드)
│   ├── enhancement.py      # LLM 에이전트 팀 플래닝 (Enhance 모드)
│   ├── websocket.py        # RFC 6455 WebSocket 구현
│   └── routes.py           # 비동기 HTTP 라우터
├── public/                 # 프론트엔드 (빌드 불필요)
│   ├── index.html
│   ├── js/
│   │   ├── constants.js    # AppState, HOME_TEMPLATES_RAW, HOME_VARIANTS
│   │   ├── i18n.js         # EN/KO 번역, t(), toggleLang()
│   │   ├── ws.js           # WebSocket 클라이언트, 테마/언어 헬퍼
│   │   ├── home.js         # 홈 화면 로직
│   │   ├── kanban.js       # 칸반 보드
│   │   ├── modal.js        # 스폰 모달, 플래닝 패널
│   │   └── explorer.js     # 파일 탐색기
│   └── css/
│       ├── base.css        # 변수, 리셋, lang-btn
│       ├── home.css        # 홈 화면 스타일
│       └── kanban.css      # 칸반 보드 + 모달 스타일
├── ccpilot.db              # SQLite 데이터베이스 (자동 생성)
└── tests/                  # 단위/통합 테스트 (표준 라이브러리 unittest)
```

---

## API 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| `GET` | `/` | index.html 서빙 |
| `GET` | `/static/*` | 정적 파일 |
| `WS` | `/ws/{sid}` | WebSocket 스트림 |
| `GET` | `/api/sessions` | 저장된 세션 목록 |
| `POST` | `/api/sessions/restore` | 시작 시 세션 복원 |
| `POST` | `/api/session` | 세션 생성 |
| `DELETE` | `/api/session/{sid}` | 세션 삭제 |
| `POST` | `/api/session/{sid}/phase` | 칸반 단계 이동 |
| `POST` | `/api/session/{sid}/rename` | 태스크 이름 변경 |
| `POST` | `/api/session/{sid}/model` | 세션 모델 변경 |
| `GET` | `/api/projects` | 프로젝트 목록 |
| `POST` | `/api/projects` | 프로젝트 생성 |
| `POST` | `/api/projects/{pid}/rename` | 프로젝트 이름 변경 |
| `DELETE` | `/api/projects/{pid}` | 프로젝트 삭제 |
| `POST` | `/api/plan/text` | 텍스트로 플래닝 (`mode`, `lang`, `design_files`) |
| `POST` | `/api/plan/file` | 파일 업로드로 플래닝 (`mode`, `lang`) |
| `POST` | `/api/plan/spawn` | 에이전트 팀 스폰 (`design_files` → `design/` 저장) |
| `GET` | `/api/explorer?dir=` | 디렉토리 목록 |
| `POST` | `/api/explorer/open` | OS 파일 탐색기 열기 |
| `POST` | `/api/explorer/read` | 파일 내용 읽기 |
| `GET` | `/api/folder-dialog` | OS 네이티브 폴더 선택 다이얼로그 |

---

## 빌드 (실행 파일)

PyInstaller + pywebview로 독립 실행 파일(`.exe`)로 패키징합니다.

```bash
pip install pyinstaller pywebview
pyinstaller CCPilot.spec
# 결과물: dist/CCPilot.exe
```

Windows용 사전 빌드 바이너리는 [Releases](https://github.com/devchan97/CC-Pilot/releases) 페이지에서 다운로드할 수 있습니다.

> `.exe`는 CCPilot 자체만 포함합니다. **Claude Code CLI 설치 및 인증은 실행 환경에도 별도로 필요합니다** (위 사전 준비사항 참조).

---

## 기여

```bash
git clone https://github.com/devchan97/CC-Pilot
cd CC-Pilot
python main.py  # 설치 불필요
```

테스트 실행 (추가 패키지 불필요):

```bash
python -m unittest discover tests
```

백엔드 코드는 `ccpilot/` 하위에 있습니다. 프론트엔드는 `public/`의 순수 HTML/CSS/JS로 번들러나 빌드 과정이 없습니다.

---

## 라이선스

MIT
