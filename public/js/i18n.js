// ── 다국어 지원 (EN/KO) ────────────────────────────────────────────────────────
const I18N = {
  en: {
    // 사이드바
    'nav.new_project': 'New Project',
    'nav.projects': 'Projects',
    'nav.trash': '🗑 Trash',
    'nav.trash_clear': 'Clear',
    'nav.no_projects': 'No projects',
    'nav.open_sidebar': 'Open Sidebar',
    'nav.theme_toggle': 'Toggle Theme',
    'nav.delete': '✕',

    // 홈화면
    'home.sub': 'Describe your project or upload a document —\nClaude Code will design an agent team for you.',
    'home.placeholder': 'Enter your project requirements, PRD, or idea…\n\nExample: E-commerce site with Next.js + FastAPI. Needs user auth, product listing, and checkout.',
    'home.attach_file': 'Attach file (.md/.txt)',
    'home.select_folder': 'Select working folder',
    'home.reselect_folder': 'Click to re-select folder',
    'home.clear_path': 'Clear path',

    // 홈 모드 선택
    'home.mode.planning':    'Plan',
    'home.mode.refactoring': 'Refactor',
    'home.mode.enhancement': 'Enhance',
    'home.mode_placeholder.planning':    'Describe your project requirements, PRD, or idea…\n\nExample: E-commerce site with Next.js + FastAPI. Needs user auth, product listing, and checkout.',
    'home.mode_placeholder.refactoring': 'Describe the codebase to refactor…\n\nExample: Legacy Express.js API with no TypeScript. Needs migration to NestJS, proper DI, and full test coverage.',
    'home.mode_placeholder.enhancement': 'Describe the service or feature to enhance…\n\nExample: Existing REST API with 3s avg response time. Need caching, DB query optimization, and horizontal scaling.',

    // 카루셀 버튼 라벨 (constants.js와 연동)
    'home.btn.webapp': '🌐 Web App',
    'home.btn.landing': '🎯 Landing Page',
    'home.btn.dashboard': '📊 Dashboard',
    'home.btn.ecommerce': '🛒 E-Commerce',
    'home.btn.portfolio': '🎨 Portfolio',
    'home.btn.blog': '✍️ Blog / CMS',
    'home.btn.saas': '💼 SaaS',
    'home.btn.api': '⚡ REST API',
    'home.btn.graphql': '🔗 GraphQL API',
    'home.btn.microservice': '🧩 Microservice',
    'home.btn.realtime': '🔴 Realtime App',
    'home.btn.devtools': '🛠 Dev Tool',
    'home.btn.infra': '☁️ Infra / DevOps',
    'home.btn.security': '🔒 Security',
    'home.btn.testing': '🧪 Test Suite',
    'home.btn.finance': '💰 Finance',
    'home.btn.health': '🏥 Healthcare',
    'home.btn.edu': '📚 Education',
    'home.btn.map': '🗺 Maps / Location',
    'home.btn.media': '🎥 Media',
    'home.btn.iot': '📡 IoT',
    'home.btn.blockchain': '⛓ Blockchain',
    'home.btn.cms': '📝 CMS',
    'home.btn.email': '📧 Email',
    'home.btn.search': '🔍 Search',
    'home.btn.queue': '📨 Queue',
    'home.btn.payment': '💳 Payments',
    'home.btn.notification': '🔔 Notifications',
    'home.btn.lowcode': '🧱 Low-code',
    'home.btn.os': '🖥 Desktop App',
    'home.btn.doc': '📖 Docs Site',
    'home.btn.interview': '🤝 Interview Prep',
    'home.btn.mobile': '📱 Mobile App',
    'home.btn.game': '🎮 Game',
    'home.btn.cicd': '🚀 CI/CD',
    'home.btn.ml': '🧠 ML / AI',
    'home.btn.monitoring': '🔍 Monitoring',
    'home.btn.cli': '⌨️ CLI Tool',
    'home.btn.forum': '💬 Forum',
    'home.btn.pwa': '📲 PWA',
    'home.btn.auth': '🔐 Auth Service',
    'home.btn.desktop': '🖥️ Desktop App',
    'home.btn.vscode': '🧩 VSCode Ext',
    'home.btn.chrome': '🔌 Chrome Ext',
    'home.btn.chatbot': '🤖 Chatbot',
    'home.btn.rag': '📚 RAG System',
    'home.btn.agent': '🕵️ AI Agent',
    'home.btn.scraper': '🕷️ Web Scraper',
    'home.btn.etl': '🔄 ETL Pipeline',
    'home.btn.analytics': '📈 Analytics',
    'home.btn.automation': '⚡ Automation',
    'home.btn.webgame': '🕹️ Web Game',
    'home.btn.discord': '🤖 Discord Bot',
    'home.btn.slack': '💼 Slack App',
    'home.btn.telegram': '✈️ Telegram Bot',
    'home.btn.coding': '🏆 Coding Platform',
    'home.btn.openapi': '📝 OpenAPI SDK',

    // 칸반 보드
    'kanban.auto_team': '⚡ Auto-generate Team',
    'kanban.add_task': '+ Task',
    'kanban.col_backlog': 'Backlog',
    'kanban.col_inprogress': 'In Progress',
    'kanban.col_done': 'Done',
    'kanban.no_tasks': 'No tasks',
    'kanban.add_task_col': '+ Add Task',
    'kanban.project_label': 'Project',

    // Planning 패널
    'plan.title': 'Auto-generate Agent Team',
    'plan.sub': 'Paste project documents — Claude will design your agent team',
    'plan.tab_text': 'Text Input',
    'plan.tab_file': 'File Upload',
    'plan.textarea_placeholder': 'Paste your project description, requirements, PRD…',
    'plan.file_drop': 'Click or drag a .md / .txt file here',
    'plan.no_file': 'No file selected',
    'plan.path_placeholder': 'Project root path (leave empty for server default)',
    'plan.select_folder': 'Select folder',
    'plan.run': 'Analyze',

    // 태스크 모달
    'modal.new_task': 'New Task',
    'modal.task_name': 'Task Name',
    'modal.task_name_placeholder': 'e.g. Fix login bug',
    'modal.initial_phase': 'Initial Phase',
    'modal.cwd': 'Working Directory (optional)',
    'modal.cwd_placeholder': 'Leave empty for server default',
    'modal.model': 'Model',
    'modal.model_default': 'Default (Sonnet 4.6)',
    'modal.init_prompt': 'Initial Message (optional)',
    'modal.init_prompt_placeholder': 'Message to auto-send when session starts',
    'modal.cancel': 'Cancel',
    'modal.create': 'Create',

    // 프로젝트 모달
    'modal.new_project': 'New Project',
    'modal.project_name': 'Project Name',
    'modal.project_name_placeholder': 'e.g. Shopping Mall v2',
    'modal.root_path': 'Root Path (optional)',

    // Spawn 모달
    'spawn.title': 'Agent Team Proposal',
    'spawn.approve': 'Approve & Spawn',
    'spawn.proj_name': 'Project Name',
    'spawn.work_folder': 'Working Folder',
    'spawn.select_folder': '📁 Select Folder',
    'spawn.no_folder': '(not set — using server default)',
    'spawn.prereq_title': '⚠ Prerequisites before Spawn',
    'spawn.agent_name': 'Name',
    'spawn.agent_path': 'Path',
    'spawn.agent_model': 'Model',
    'spawn.agent_task': 'Task',
    'spawn.analyze_loading': 'Claude is analyzing your project…',
    'spawn.analyzing_title': 'Analyzing…',
    'spawn.analyzing_cancel': 'Cancel',
    'spawn.add_agent': '+ Add Agent',
    'spawn.remove_agent': 'Remove',
    'spawn.prereq_uncheck': 'Please check all prerequisites before spawning.',
    'spawn.new_agent_name': 'New Agent',
    'spawn.new_agent_role': 'agent',
    'spawn.new_agent_prompt': '',

    // 상세 모달
    'detail.open_explorer': 'Open in Explorer',
    'detail.done_notice': '✓ This task is complete. Move it to In Progress to resume.',
    'detail.done_label': 'Last completion record',
    'detail.done_placeholder': 'Task is done. Move to In Progress to resume conversation.',
    'detail.done_tag': 'Completed task',
    'detail.input_placeholder': 'Message  /clear  /compact  (Enter=send, Shift+Enter=newline)',

    // Explorer
    'explorer.title': 'Explorer',
    'explorer.loading': 'Loading…',
    'explorer.empty': 'Empty folder',
    'explorer.up': '↑ Up',
    'explorer.refresh': '↺',
    'explorer.browse': '📁 Browse',
    'explorer.path_placeholder': 'Type a path and press Enter…',
    'explorer.path_hint': 'Click to edit path — ',
    'explorer.pick_hint': 'Select this folder',
    'explorer.pick_confirm': '✔ Select Here',
    'explorer.load_fail': '⚠ Load failed',

    // WS / 연결 상태
    'ws.connecting': 'Connecting…',
    'ws.ready': 'Ready',
    'ws.disconnected': 'Disconnected',
    'ws.cleared': 'Context cleared.',
    'ws.error': 'Error: ',
    'ws.done_auto': '✓ Goal achieved — moved to Done.',
    'ws.restore': 'Restore',
    'ws.queued': 'Queued',
    'ws.queue_label': 'Queued messages',

    // 확인 모달
    'confirm.ok': 'OK',
    'confirm.cancel': 'Cancel',
    'confirm.delete_project': 'Delete this project?\nAll connected sessions will also be removed.',
    'confirm.delete_task': 'Delete this task?',
    'confirm.delete': 'Delete',

    // 휴지통
    'trash.restore': '↩',

    // 오류 메시지
    'err.enter_text_or_file': 'Enter text or attach a file.',
    'err.analysis': 'Analysis error: ',
    'err.no_agents': 'No agents suggested. Try providing more detail.',
    'err.request_failed': 'Request failed: ',
    'err.file_read': 'File read failed: ',
    'err.enter_text': 'Enter text.',
    'err.select_file': 'Select a file.',
    'err.spawn': 'Spawn error: ',
    'err.spawn_fail': 'Spawn failed: ',
    'err.project_name': 'Enter a project name.',
    'err.need_folder': 'Please set a working folder.\nRefactor / Enhance modes require an existing project directory.',

    // 파일 형식 오류
    'err.file_type': 'Unsupported file type: ',
    'err.file_type_detail': 'Claude Code supports: ',

    // Usage
    'usage.remaining': 'remaining',
    
    // Limits
    'err.usage_limit': 'Usage limit reached. Entering wait mode.',
    'err.usage_limit_reset': 'Resets at',
  },
  ko: {
    // 사이드바
    'nav.new_project': '새 프로젝트',
    'nav.projects': 'Projects',
    'nav.trash': '🗑 휴지통',
    'nav.trash_clear': '비우기',
    'nav.no_projects': '프로젝트 없음',
    'nav.open_sidebar': '사이드바 열기',
    'nav.theme_toggle': '테마 전환',
    'nav.delete': '✕',

    // 홈화면
    'home.sub': '프로젝트를 설명하거나 문서를 업로드하면\nClaude Code를 사용하여 에이전트 팀을 설계합니다',
    'home.placeholder': '프로젝트 요구사항, PRD, 아이디어를 입력하세요…\n\n예: Next.js + FastAPI 기반 쇼핑몰. 사용자 인증, 상품 목록, 결제 기능 필요.',
    'home.attach_file': '파일 첨부 (.md/.txt)',
    'home.select_folder': '작업 폴더 선택',
    'home.reselect_folder': '클릭하여 폴더 재선택',
    'home.clear_path': '경로 지우기',

    // 홈 모드 선택
    'home.mode.planning':    'Plan',
    'home.mode.refactoring': 'Refactor',
    'home.mode.enhancement': 'Enhance',
    'home.mode_placeholder.planning':    '프로젝트 요구사항, PRD, 아이디어를 입력하세요…\n\n예: Next.js + FastAPI 기반 쇼핑몰. 사용자 인증, 상품 목록, 결제 기능 필요.',
    'home.mode_placeholder.refactoring': '리팩토링할 코드베이스를 설명하세요…\n\n예: 타입스크립트 없는 레거시 Express.js API. NestJS 마이그레이션, 의존성 주입, 테스트 커버리지 100% 목표.',
    'home.mode_placeholder.enhancement': '고도화할 서비스나 기능을 설명하세요…\n\n예: 평균 응답 3초인 REST API. 캐싱, DB 쿼리 최적화, 수평 확장 구조로 개선 필요.',

    // 카루셀 버튼 라벨
    'home.btn.webapp': '🌐 웹앱',
    'home.btn.landing': '🎯 랜딩페이지',
    'home.btn.dashboard': '📊 대시보드',
    'home.btn.ecommerce': '🛒 이커머스',
    'home.btn.portfolio': '🎨 포트폴리오',
    'home.btn.blog': '✍️ 블로그/CMS',
    'home.btn.saas': '💼 SaaS',
    'home.btn.api': '⚡ REST API',
    'home.btn.graphql': '🔗 GraphQL API',
    'home.btn.microservice': '🧩 마이크로서비스',
    'home.btn.realtime': '🔴 실시간 앱',
    'home.btn.devtools': '🛠 개발도구',
    'home.btn.infra': '☁️ 인프라/DevOps',
    'home.btn.security': '🔒 보안',
    'home.btn.testing': '🧪 테스트',
    'home.btn.finance': '💰 금융',
    'home.btn.health': '🏥 헬스케어',
    'home.btn.edu': '📚 교육',
    'home.btn.map': '🗺 지도/위치',
    'home.btn.media': '🎥 미디어',
    'home.btn.iot': '📡 IoT',
    'home.btn.blockchain': '⛓ 블록체인',
    'home.btn.cms': '📝 CMS',
    'home.btn.email': '📧 이메일',
    'home.btn.search': '🔍 검색',
    'home.btn.queue': '📨 큐/메시지',
    'home.btn.payment': '💳 결제',
    'home.btn.notification': '🔔 알림',
    'home.btn.lowcode': '🧱 로우코드',
    'home.btn.os': '🖥 데스크탑앱',
    'home.btn.doc': '📖 문서사이트',
    'home.btn.interview': '🤝 면접준비',
    'home.btn.mobile': '📱 모바일앱',
    'home.btn.game': '🎮 게임',
    'home.btn.cicd': '🚀 CI/CD',
    'home.btn.ml': '🧠 ML/AI',
    'home.btn.monitoring': '🔍 모니터링',
    'home.btn.cli': '⌨️ CLI 도구',
    'home.btn.forum': '💬 포럼',
    'home.btn.pwa': '📲 PWA',
    'home.btn.auth': '🔐 인증 서비스',
    'home.btn.desktop': '🖥️ 데스크탑앱',
    'home.btn.vscode': '🧩 VSCode 확장',
    'home.btn.chrome': '🔌 Chrome 확장',
    'home.btn.chatbot': '🤖 챗봇',
    'home.btn.rag': '📚 RAG 시스템',
    'home.btn.agent': '🕵️ AI 에이전트',
    'home.btn.scraper': '🕷️ 웹 크롤러',
    'home.btn.etl': '🔄 ETL 파이프라인',
    'home.btn.analytics': '📈 데이터 분석',
    'home.btn.automation': '⚡ 업무 자동화',
    'home.btn.webgame': '🕹️ 브라우저 게임',
    'home.btn.discord': '🤖 Discord 봇',
    'home.btn.slack': '💼 Slack 앱',
    'home.btn.telegram': '✈️ Telegram 봇',
    'home.btn.coding': '🏆 코딩 플랫폼',
    'home.btn.openapi': '📝 OpenAPI SDK',

    // 칸반 보드
    'kanban.auto_team': '⚡ 팀 자동 생성',
    'kanban.add_task': '+ 태스크',
    'kanban.col_backlog': 'Backlog',
    'kanban.col_inprogress': 'In Progress',
    'kanban.col_done': 'Done',
    'kanban.no_tasks': '태스크 없음',
    'kanban.add_task_col': '+ 태스크 추가',
    'kanban.project_label': '프로젝트',

    // Planning 패널
    'plan.title': 'Agent Team 자동 생성',
    'plan.sub': '프로젝트 문서를 입력하면 Claude가 에이전트 팀을 설계합니다',
    'plan.tab_text': '텍스트 입력',
    'plan.tab_file': '파일 업로드',
    'plan.textarea_placeholder': '프로젝트 설명, 요구사항, PRD 등을 붙여넣으세요…',
    'plan.file_drop': '클릭하거나 .md / .txt 파일을 드래그',
    'plan.no_file': '선택된 파일 없음',
    'plan.path_placeholder': '프로젝트 루트 경로 (비우면 서버 현재 디렉토리)',
    'plan.select_folder': '폴더 선택',
    'plan.run': '분석 시작',

    // 태스크 모달
    'modal.new_task': '새 태스크',
    'modal.task_name': '태스크 이름',
    'modal.task_name_placeholder': '예: 로그인 버그 수정',
    'modal.initial_phase': '초기 단계',
    'modal.cwd': '작업 경로 (선택)',
    'modal.cwd_placeholder': '비우면 서버 기본 디렉토리',
    'modal.model': '모델 선택',
    'modal.model_default': '기본 (Sonnet 4.6)',
    'modal.init_prompt': '초기 메시지 (선택)',
    'modal.init_prompt_placeholder': '세션 생성 후 자동 전송할 메시지',
    'modal.cancel': '취소',
    'modal.create': '만들기',

    // 프로젝트 모달
    'modal.new_project': '새 프로젝트',
    'modal.project_name': '프로젝트 이름',
    'modal.project_name_placeholder': '예: 쇼핑몰 v2',
    'modal.root_path': '루트 경로 (선택)',

    // Spawn 모달
    'spawn.title': '에이전트 팀 구성 제안',
    'spawn.approve': '승인 & Spawn',
    'spawn.proj_name': '프로젝트 이름',
    'spawn.work_folder': '작업 폴더',
    'spawn.select_folder': '📁 폴더 선택',
    'spawn.no_folder': '(미설정 — 서버 기본 디렉토리 사용)',
    'spawn.prereq_title': '⚠ Spawn 전 사전 준비 사항',
    'spawn.agent_name': '이름',
    'spawn.agent_path': '경로',
    'spawn.agent_model': '모델',
    'spawn.agent_task': '태스크',
    'spawn.analyze_loading': 'Claude가 프로젝트를 분석 중…',
    'spawn.analyzing_title': '분석 중…',
    'spawn.analyzing_cancel': '취소',
    'spawn.add_agent': '+ 에이전트 추가',
    'spawn.remove_agent': '제거',
    'spawn.prereq_uncheck': 'Spawn 전 모든 사전 준비 사항을 체크해주세요.',
    'spawn.new_agent_name': '새 에이전트',
    'spawn.new_agent_role': 'agent',
    'spawn.new_agent_prompt': '',

    // 상세 모달
    'detail.open_explorer': 'Explorer에서 열기',
    'detail.done_notice': '✓ 이 태스크는 완료된 상태입니다. 다시 진행하려면 In Progress로 이동하세요.',
    'detail.done_label': '마지막 완료 기록',
    'detail.done_placeholder': '완료된 태스크입니다. In Progress로 이동하면 대화가 재개됩니다.',
    'detail.done_tag': '완료된 태스크',
    'detail.input_placeholder': '메시지  /clear  /compact  (Enter=전송, Shift+Enter=줄바꿈)',

    // Explorer
    'explorer.title': 'Explorer',
    'explorer.loading': '로딩 중…',
    'explorer.empty': '빈 폴더',
    'explorer.up': '↑ 상위',
    'explorer.refresh': '↺',
    'explorer.browse': '📁 폴더 탐색',
    'explorer.path_placeholder': '경로 직접 입력 후 Enter…',
    'explorer.path_hint': '클릭하여 경로 직접 입력 — ',
    'explorer.pick_hint': '현재 폴더를 선택',
    'explorer.pick_confirm': '✔ 여기 선택',
    'explorer.load_fail': '⚠ 로드 실패',

    // WS / 연결 상태
    'ws.connecting': '연결 중…',
    'ws.ready': '준비됨',
    'ws.disconnected': '연결 끊김',
    'ws.cleared': 'Context 및 화면이 초기화되었습니다.',
    'ws.error': '오류: ',
    'ws.done_auto': '✓ 목표 달성이 감지되어 Done으로 이동했습니다.',
    'ws.restore': '복원',
    'ws.queued': '대기',
    'ws.queue_label': '대기 중인 메시지',

    // 확인 모달
    'confirm.ok': '확인',
    'confirm.cancel': '취소',
    'confirm.delete_project': '프로젝트를 삭제할까요?\n연결된 세션도 함께 삭제됩니다.',
    'confirm.delete_task': '태스크를 삭제할까요?',
    'confirm.delete': '삭제',

    // 휴지통
    'trash.restore': '↩',

    // 오류 메시지
    'err.enter_text_or_file': '텍스트를 입력하거나 파일을 첨부하세요.',
    'err.analysis': '분석 오류: ',
    'err.no_agents': '에이전트 제안이 없습니다. 내용을 더 구체적으로 작성해보세요.',
    'err.request_failed': '요청 실패: ',
    'err.file_read': '파일 읽기 실패: ',
    'err.enter_text': '텍스트를 입력하세요.',
    'err.select_file': '파일을 선택하세요.',
    'err.spawn': 'Spawn 오류: ',
    'err.spawn_fail': 'Spawn 실패: ',
    'err.project_name': '프로젝트 이름을 입력하세요.',
    'err.need_folder': '작업 폴더를 설정해주세요.\nRefactor / Enhance 모드는 기존 프로젝트 디렉토리가 필요합니다.',

    // 파일 형식 오류
    'err.file_type': '지원하지 않는 파일 형식: ',
    'err.file_type_detail': 'Claude Code 지원 형식: ',

    // Usage
    'usage.remaining': '잔여',

    // Limits
    'err.usage_limit': '사용량 한도에 도달했습니다. 대기 모드로 진입합니다.',
    'err.usage_limit_reset': '초기화 시간',
  }
};

// 현재 언어 (기본 EN)
let _lang = 'en';

// 번역 함수
function t(key, fallback) {
  return (I18N[_lang] && I18N[_lang][key]) || (I18N['en'] && I18N['en'][key]) || fallback || key;
}

// 언어 변경 및 DOM 업데이트
function setLang(lang) {
  if(lang !== 'en' && lang !== 'ko') return;
  _lang = lang;
  try { localStorage.setItem('ccpilot_lang', lang); } catch(e) {}
  _applyI18n();
}

function getLang() { return _lang; }

// DOM의 data-i18n 속성 일괄 적용
function _applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.dataset.i18nTitle);
  });
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    el.innerHTML = t(el.dataset.i18nHtml);
  });
  // 언어 토글 버튼 텍스트 갱신
  const btn = document.getElementById('lang-btn');
  if(btn) btn.textContent = _lang === 'en' ? 'KO' : 'EN';
  // 캐러셀 버튼 라벨 갱신
  const track = document.getElementById('carousel-track');
  if(track && typeof HOME_BUTTONS_ORDER !== 'undefined'){
    track.querySelectorAll('.home-quick-btn').forEach((el, i) => {
      const tpl = HOME_BUTTONS_ORDER[i];
      if(tpl) el.textContent = t('home.btn.' + tpl.key);
    });
  }
  // 홈 textarea placeholder를 현재 모드에 맞게 갱신
  if(typeof getHomeMode === 'function'){
    const ta = document.getElementById('home-textarea');
    if(ta){
      const ph = t('home.mode_placeholder.' + getHomeMode());
      if(ph) ta.placeholder = ph;
    }
  }
}

// 초기화 (localStorage 복원 + DOM 적용)
(function _initLang() {
  try {
    const saved = localStorage.getItem('ccpilot_lang');
    if(saved === 'en' || saved === 'ko') _lang = saved;
  } catch(e) {}
  // DOM 준비 후 i18n 일괄 적용
  document.addEventListener('DOMContentLoaded', _applyI18n);
})();
