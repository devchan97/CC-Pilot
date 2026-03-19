# CCPilot

**[English](README.md)**

브라우저에서 여러 Claude Code CLI 인스턴스를 제어하는 칸반보드 기반 에이전트 팀 관리 WebUI.

[![Python 3.11+](https://img.shields.io/badge/Python-3.11+-3776ab?logo=python&logoColor=white)](https://python.org)
[![No dependencies](https://img.shields.io/badge/dependencies-none-brightgreen)](https://github.com/devchan97/CC-Pilot)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)](https://github.com/devchan97/CC-Pilot)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> PRD나 설명을 입력하면 Claude가 에이전트 팀 구성을 설계하고, CCPilot이 Claude Code 인스턴스를 스폰해 칸반보드에서 실시간으로 추적합니다.

![CCPilot 스크린샷](public/logo.png)

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
```

> **네이티브 앱 창**은 `pywebview`가 필요합니다. 설치되지 않은 경우 자동으로 시스템 브라우저로 전환됩니다.

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
sudo apt install python3 python3-pip nodejs npm
npm install -g @anthropic-ai/claude-code
```

---

## 주요 기능

- **에이전트 팀 자동 생성** — PRD 붙여넣기 또는 파일 업로드 시 Claude가 팀 구조를 설계하고 에이전트를 자동 스폰
- **다중 세션 칸반** — 여러 Claude Code 인스턴스를 Backlog / In Progress / Done 카드로 관리
- **실시간 스트리밍** — WebSocket 기반 출력 (`thinking`, `tool_use`, 토큰/비용 추적 포함)
- **세션 영속화** — `--resume`으로 재시작 후에도 세션 복원, 다음 실행 시 자동 복원
- **내장 파일 탐색기** — 사이드바에서 작업 디렉토리 탐색 및 선택
- **순수 표준 라이브러리** — 런타임에 pip 설치 불필요

---

## 동작 원리

```
브라우저 (WebUI)
     │  WebSocket / HTTP
     ▼
main.py  ──►  ccpilot/routes.py    (HTTP 라우터)
              ccpilot/websocket.py  (WS 프로토콜)
              ccpilot/session.py    (Claude CLI 서브프로세스)
              ccpilot/planning.py   (에이전트 팀 설계)
              ccpilot/projects.py   (프로젝트 관리)
                    │
                    ▼
              claude --resume <session-id>  (Claude Code CLI)
```

각 칸반 카드는 하나의 Claude Code 서브프로세스에 대응합니다. 서버는 JSON 출력을 스트리밍해 WebSocket으로 브라우저에 실시간 전달합니다.

---

## 프로젝트 구조

```
ccpilot/
├── main.py              # 진입점
├── ccpilot/             # 백엔드 패키지 (순수 표준 라이브러리)
│   ├── utils.py         # 정적 파일 서빙, 경로 처리, Claude 탐색
│   ├── session.py       # 세션 라이프사이클 + SessionManager
│   ├── projects.py      # 프로젝트 CRUD + 영속화
│   ├── planning.py      # LLM 기반 에이전트 팀 플래닝
│   ├── websocket.py     # RFC 6455 WebSocket 구현
│   └── routes.py        # 비동기 HTTP 라우터 (18개 엔드포인트)
└── public/              # 프론트엔드 (빌드 불필요)
    ├── index.html
    ├── js/              # constants · ws · home · lifecycle · modal · explorer
    └── css/             # base · home · lifecycle
```

---

## API 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| `GET` | `/` | index.html 서빙 |
| `GET` | `/static/*` | 정적 파일 |
| `WS` | `/ws/{sid}` | WebSocket 스트림 |
| `GET` | `/api/sessions` | 저장된 세션 목록 |
| `POST` | `/api/sessions/restore` | 세션 복원 |
| `POST` | `/api/session` | 세션 생성 |
| `DELETE` | `/api/session/{sid}` | 세션 삭제 |
| `POST` | `/api/session/{sid}/phase` | 칸반 단계 이동 |
| `POST` | `/api/session/{sid}/rename` | 태스크 이름 변경 |
| `GET` | `/api/projects` | 프로젝트 목록 |
| `POST` | `/api/projects` | 프로젝트 생성 |
| `DELETE` | `/api/projects/{pid}` | 프로젝트 삭제 |
| `POST` | `/api/plan/text` | 텍스트로 플래닝 |
| `POST` | `/api/plan/file` | 파일 업로드로 플래닝 |
| `POST` | `/api/plan/spawn` | 에이전트 팀 스폰 |
| `GET` | `/api/explorer?dir=` | 디렉토리 목록 |
| `POST` | `/api/explorer/open` | OS 파일 탐색기 열기 |

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

백엔드 코드는 `ccpilot/` 하위에 있습니다. 프론트엔드는 `public/`의 순수 HTML/CSS/JS로 번들러나 빌드 과정이 없습니다.

---

## 라이선스

MIT
