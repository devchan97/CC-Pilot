// ── HTML 이스케이프 유틸 ───────────────────────────────────────────────────────
function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ── slash commands ─────────────────────────────────────────────────────────────
const CMD_REGISTRY = {};

function registerCmds(list){
  (list||[]).forEach(item=>{
    const entry = typeof item === 'string'
      ? {name: item.startsWith('/') ? item : '/'+item, description:'', source:'claude'}
      : item;
    if(!entry.name.startsWith('/')) entry.name = '/'+entry.name;
    if(!CMD_REGISTRY[entry.name]){
      CMD_REGISTRY[entry.name] = entry;
    } else if(!CMD_REGISTRY[entry.name].description && entry.description){
      CMD_REGISTRY[entry.name].description = entry.description;
    }
  });
}

// ── 퀵버튼 변형 옵션 (key → 3개 이상) ──────────────────────────────────────────
const HOME_VARIANTS = {
  webapp: [
    { label:'Next.js 15 + FastAPI', text:'Next.js 15 App Router + FastAPI 풀스택 웹앱.\n사용자 인증(NextAuth v5), Server Actions, Shadcn UI, PostgreSQL(Drizzle ORM), 실시간 알림(SSE) 필요.' },
    { label:'React + Hono (엣지)', text:'React SPA + Hono 엣지 API (Cloudflare Workers).\nD1 DB, KV 캐시, JWT 인증, Zod 검증, Wrangler 배포 필요.' },
    { label:'T3 Stack (풀스택 타입세이프)', text:'T3 Stack (Next.js + tRPC + Prisma + Tailwind).\n타입세이프 API, 세션 인증(NextAuth), Supabase DB, Vercel 배포 필요.' },
    { label:'SvelteKit + Bun', text:'SvelteKit + Bun 백엔드 풀스택 앱.\nForm actions, Lucia 인증, SQLite(LibSQL), 서버사이드 렌더링, Fly.io 배포 필요.' },
  ],
  landing: [
    { label:'Astro + TailwindCSS', text:'Astro 5 기반 제품 랜딩 페이지.\n히어로 섹션, 가격표, FAQ, 뉴스레터(Resend), 애니메이션(Motion), Core Web Vitals 100점 목표.' },
    { label:'Next.js + Framer Motion', text:'Next.js + Framer Motion 랜딩 페이지.\n스크롤 애니메이션, 3D 카드, 파티클 배경, CTA 버튼, A/B 테스트(Vercel) 포함.' },
    { label:'정적 HTML + GSAP', text:'순수 HTML/CSS/JS + GSAP 스크롤 애니메이션 랜딩.\n번들 제로, CDN 배포, Lighthouse 100점, 뉴스레터 폼(Formspree) 포함.' },
  ],
  dashboard: [
    { label:'React + Recharts + Shadcn', text:'React 관리자 대시보드 (Shadcn/ui + Recharts).\n실시간 차트, 날짜 필터, CSV 내보내기, 다크모드, 반응형, RBAC 권한 관리 필요.' },
    { label:'Next.js + Tremor', text:'Next.js App Router + Tremor UI 대시보드.\nServer Components로 차트 렌더, Prisma + PostgreSQL, 팀/역할 관리, Vercel Analytics 연동.' },
    { label:'Vue 3 + ECharts', text:'Vue 3 Composition API + Apache ECharts 대시보드.\n실시간 웹소켓 데이터, 커스텀 테마, 드래그 레이아웃(Vue Draggable), FastAPI 백엔드.' },
  ],
  ecommerce: [
    { label:'Next.js + Stripe', text:'Next.js 15 이커머스 (Stripe Checkout + Webhooks).\n상품 목록/상세/장바구니, 결제, 주문 추적, 재고 관리, Stripe Customer Portal 필요.' },
    { label:'Medusa.js (헤드리스)', text:'Medusa.js 헤드리스 커머스 + Next.js 스토어프론트.\n플러그인 아키텍처, 다중 통화, 할인 쿠폰, 어드민 대시보드, Stripe/PayPal 지원.' },
    { label:'Shopify Hydrogen', text:'Shopify Hydrogen (React) 커스텀 스토어프론트.\nShopify Storefront API, 서버 컴포넌트, 캐싱 전략, Analytics, Oxygen 배포 필요.' },
  ],
  forum: [
    { label:'Next.js + PostgreSQL', text:'개발자 커뮤니티 포럼 (Next.js + PostgreSQL).\n게시글/댓글, 마크다운 에디터(Tiptap), 태그, 검색(Fuse.js), 좋아요, 포인트 시스템 필요.' },
    { label:'Discourse-like (Node.js)', text:'Discourse 스타일 포럼 (Node.js + Redis + PostgreSQL).\n실시간 알림(Socket.io), 이메일 다이제스트, 뱃지/신뢰 레벨, 풀텍스트 검색 필요.' },
    { label:'Flarum 스타일 SPA', text:'SPA 포럼 (Vue 3 + Laravel API).\nJSON:API 스펙, 무한 스크롤, 태그 필터, 멘션/알림, 이메일 인증, OAuth 소셜 로그인.' },
  ],
  portfolio: [
    { label:'Next.js + Framer Motion', text:'개발자 포트폴리오 (Next.js 15 + Framer Motion).\n3D 카드 갤러리, 블로그(MDX), 다크모드, SEO, OG 이미지 자동 생성, Vercel 배포.' },
    { label:'Astro + Three.js', text:'Astro + Three.js 인터랙티브 포트폴리오.\n3D 배경 씬, 스크롤 트리거 애니메이션, 작업물 갤러리, 이력서 PDF 생성 필요.' },
    { label:'Gatsby + Contentful', text:'Gatsby + Contentful CMS 포트폴리오.\nGraphQL 데이터 레이어, ISR, 프로젝트 CMS 관리, Algolia 검색, PWA 설정 포함.' },
  ],
  api: [
    { label:'FastAPI + PostgreSQL', text:'REST API 서버 (Python FastAPI + PostgreSQL).\nJWT 인증, rate limiting(slowapi), Alembic 마이그레이션, OpenAPI 자동 문서, 도커 배포.' },
    { label:'Hono + Bun (엣지 API)', text:'Hono + Bun 초고속 REST API.\nZod 검증, Bearer 인증, SQLite(LibSQL), 테스트(Vitest), Cloudflare Workers 배포 가능.' },
    { label:'NestJS + Prisma', text:'NestJS 엔터프라이즈 API (TypeScript + Prisma + PostgreSQL).\n모듈 아키텍처, Guards/Interceptors, Swagger, Redis 캐싱, Jest 테스트, 도커 컴포즈.' },
  ],
  graphql: [
    { label:'Apollo Server + Prisma', text:'GraphQL API (Apollo Server 4 + Prisma + PostgreSQL).\n스키마 퍼스트 설계, DataLoader, JWT 인증, 실시간 Subscription, Nexus 타입 생성.' },
    { label:'Pothos + Hono', text:'Pothos(코드 퍼스트 GraphQL) + Hono 서버.\n타입세이프 리졸버, Drizzle ORM, 인증 플러그인, Relay 페이지네이션, Bun 런타임.' },
    { label:'Hasura (자동 GraphQL)', text:'Hasura + PostgreSQL 자동 GraphQL API.\n즉시 CRUD, 퍼미션 룰, 커스텀 Action, Event Trigger, Remote Schema, Subscription 포함.' },
  ],
  microservice: [
    { label:'Python + Docker + RabbitMQ', text:'마이크로서비스 (Python FastAPI + Docker Compose + RabbitMQ).\n서비스 분리, API 게이트웨이(Nginx), 메시지 큐, 서비스 디스커버리, 분산 트레이싱.' },
    { label:'Node.js + Kafka', text:'Node.js 마이크로서비스 + Apache Kafka 이벤트 스트리밍.\n도메인 분리, 이벤트 소싱, CQRS 패턴, Kubernetes 배포, Jaeger 트레이싱 필요.' },
    { label:'Go + gRPC', text:'Go 마이크로서비스 + gRPC 통신.\nProtobuf 스키마, 서비스 메시(Consul), 회로차단기(Hystrix), Prometheus 메트릭, K8s Helm 차트.' },
  ],
  auth: [
    { label:'JWT + OAuth2 (Node.js)', text:'인증 서비스 (Node.js + Passport.js).\nJWT + refresh token rotation, OAuth2(Google/GitHub/Kakao), RBAC, 이메일 인증, MFA(TOTP).' },
    { label:'Better Auth (TypeScript)', text:'Better Auth 풀스택 인증 라이브러리 통합.\n소셜 로그인, 세션 관리, 2FA, 마법 링크, 조직/멤버 관리, Next.js App Router 연동.' },
    { label:'Keycloak + Spring', text:'Keycloak IAM + Spring Security 인증 시스템.\nSSO, SAML/OIDC, 사용자 연합, 어드민 UI, Realm 설정 자동화, 도커 배포 포함.' },
  ],
  mobile: [
    { label:'React Native + Expo', text:'React Native(Expo SDK 52) 모바일 앱.\n소셜 로그인(expo-auth-session), 푸시 알림(FCM/APNs), 오프라인(MMKV), EAS Build 배포.' },
    { label:'Flutter (크로스플랫폼)', text:'Flutter 크로스플랫폼 앱 (iOS/Android).\nRiverpod 상태관리, GoRouter, Firebase Auth + Firestore, 로컬 알림, Play Store/App Store 배포.' },
    { label:'Capacitor + Ionic', text:'Ionic + Capacitor 하이브리드 앱 (Angular/React 기반).\n네이티브 플러그인, 카메라/GPS, 오프라인 PWA, Appflow CI/CD, 두 플랫폼 동시 배포.' },
  ],
  pwa: [
    { label:'Next.js PWA', text:'Next.js 15 PWA (next-pwa + Service Worker).\n오프라인 캐싱 전략, 설치 프롬프트, 백그라운드 싱크, 푸시 알림, Web App Manifest.' },
    { label:'Vite + Workbox', text:'Vite + Workbox PWA.\n커스텀 Service Worker, 선제적 캐싱, IndexedDB 오프라인 스토리지, 업데이트 알림 UI.' },
    { label:'SvelteKit PWA', text:'SvelteKit PWA (vite-plugin-pwa).\n완전 오프라인 지원, 캐시 전략, 설치 가능, 앱 아이콘 생성, Lighthouse PWA 체크리스트 충족.' },
  ],
  cli: [
    { label:'Python + Click', text:'Python CLI 도구 (Click + Rich).\n서브커맨드, 설정 파일(TOML), 플러그인 시스템, Rich 프로그레스바, 자동완성, PyPI 배포.' },
    { label:'Node.js + Commander', text:'Node.js CLI (Commander + Inquirer + Chalk).\n인터랙티브 프롬프트, 설정 파일(cosmiconfig), 자동완성 스크립트, npm 패키지 배포.' },
    { label:'Rust + Clap', text:'Rust CLI 도구 (Clap + Indicatif).\n파싱 성능, 서브커맨드, 설정(TOML), 크로스컴파일, GitHub Actions 릴리즈 바이너리 배포.' },
  ],
  desktop: [
    { label:'Tauri 2 + React', text:'Tauri 2 + React 데스크탑 앱.\n네이티브 메뉴, 파일 시스템(Rust 백엔드), 자동 업데이터, 트레이 아이콘, macOS/Windows/Linux 빌드.' },
    { label:'Electron + React', text:'Electron + React 데스크탑 앱.\nipcMain/ipcRenderer, 네이티브 다이얼로그, 자동 업데이터(electron-updater), Squirrel 인스톨러.' },
    { label:'Flutter Desktop', text:'Flutter 데스크탑 앱 (Windows + macOS).\n네이티브 플러그인, 파일 시스템, 시스템 트레이, 자동 업데이터, MSIX/DMG 패키저.' },
  ],
  vscode: [
    { label:'Language Server + 웹뷰', text:'VSCode 확장 (TypeScript) + Language Server Protocol.\n커맨드 팔레트, 사이드바 웹뷰(React), 코드 렌즈, LSP 진단, 마켓플레이스 배포.' },
    { label:'AI 코드 어시스턴트', text:'VSCode AI 코드 어시스턴트 확장.\nInline Completions API, GitHub Copilot Chat 참여자, Claude API 연동, 스트리밍 응답.' },
    { label:'Git 워크플로 툴', text:'VSCode Git 워크플로 확장.\nSource Control Provider, Tree View, Quick Pick, Webview 패널, GitHub API 연동, 단축키 설정.' },
  ],
  chrome: [
    { label:'Manifest V3 기본', text:'Chrome 확장 (MV3 + React 팝업).\n서비스 워커, 콘텐츠 스크립트, 현재 페이지 DOM 분석, chrome.storage, 웹스토어 배포.' },
    { label:'AI 페이지 요약', text:'AI 페이지 요약 Chrome 확장 (MV3 + Claude API).\n콘텐츠 추출, 사이드패널 UI, 스트리밍 요약, API 키 관리, 하이라이트 기능 포함.' },
    { label:'생산성 트래커', text:'생산성 & 시간 추적 Chrome 확장.\n사이트별 시간 측정, 일간 리포트 차트, 차단 목록, chrome.alarms, IndexedDB 데이터 저장.' },
  ],
  chatbot: [
    { label:'Claude API + FastAPI', text:'Claude API 스트리밍 챗봇 서비스.\n멀티턴 대화, 시스템 프롬프트 커스텀, 파일 업로드(PDF/이미지), 대화 저장, Next.js 웹 UI.' },
    { label:'RAG 챗봇 (LangChain)', text:'RAG 기반 지식베이스 챗봇 (Python + LangChain + Claude).\n문서 임베딩(OpenAI/Voyage), Pinecone 벡터 검색, 출처 인용, 웹 크롤링 인덱서.' },
    { label:'멀티에이전트 어시스턴트', text:'멀티에이전트 AI 어시스턴트 (Claude Agent SDK).\n플래닝 에이전트, 실행 에이전트, 검증 에이전트 분리, 도구 사용(웹검색/코드실행), 메모리 관리.' },
  ],
  ml: [
    { label:'PyTorch + MLflow', text:'ML 훈련 파이프라인 (PyTorch + MLflow).\n데이터 전처리(Pandas), 모델 정의, 실험 추적, 하이퍼파라미터 튜닝(Optuna), FastAPI 서빙.' },
    { label:'HuggingFace 파인튜닝', text:'HuggingFace Transformers LLM 파인튜닝.\nQLoRA/LoRA, Trainer API, 데이터셋 준비, W&B 트래킹, VLLM 추론 서버 배포.' },
    { label:'scikit-learn + Streamlit', text:'머신러닝 분류/회귀 파이프라인 (scikit-learn).\n피처 엔지니어링, 교차검증, SHAP 해석, Streamlit 데모 UI, Docker 패키징.' },
  ],
  rag: [
    { label:'LangChain + Chroma + Claude', text:'RAG 시스템 (LangChain + Chroma + Claude).\n문서 청킹, 임베딩, 하이브리드 검색(BM25+벡터), 리랭킹, 출처 인용, FastAPI + 웹 UI.' },
    { label:'LlamaIndex + Pinecone', text:'LlamaIndex 기반 기업 지식 검색 시스템.\n멀티 문서 인덱스, 쿼리 라우팅, 서브쿼리 분해, Pinecone 벡터 DB, 평가(RAGAS) 포함.' },
    { label:'pgvector + PostgREST', text:'pgvector + PostgreSQL 기반 RAG.\n서버리스 임베딩(Supabase Edge), 코사인 유사도, RLS 보안, REST API 자동 생성.' },
  ],
  agent: [
    { label:'Claude Agent SDK 멀티에이전트', text:'Claude Agent SDK 멀티에이전트 시스템.\n오케스트레이터 + 서브에이전트 분리, 도구 정의, 병렬 실행, 상태 공유, 이벤트 스트리밍.' },
    { label:'LangGraph 워크플로', text:'LangGraph 기반 자율 에이전트 워크플로.\n상태 그래프, 조건부 엣지, 도구(웹검색/코드실행/파일), 사람-개입(HIL), 체크포인트 저장.' },
    { label:'AutoGen 협업 에이전트', text:'AutoGen 멀티에이전트 협업 시스템.\n어시스턴트/사용자 에이전트, 코드 실행 환경, 그룹 채팅, 역할 분담, 비용 트래킹.' },
  ],
  scraper: [
    { label:'Playwright + APScheduler', text:'Playwright 기반 동적 크롤러 + 스케줄러.\n로그인 자동화, 페이지네이션, 데이터 정제(BeautifulSoup), PostgreSQL 저장, 중복 제거.' },
    { label:'Scrapy + Redis 분산', text:'Scrapy 분산 크롤러 (scrapy-redis + Splash).\n분산 큐, JS 렌더링, 프록시 로테이션, 스로틀링, Elasticsearch 저장, Scrapyd 배포.' },
    { label:'Crawlee (Node.js)', text:'Crawlee (Apify) Node.js 크롤러.\nPlaywright + Cheerio 하이브리드, 자동 스케일링, 세션 풀, 지문 위장, 데이터셋 내보내기.' },
  ],
  etl: [
    { label:'Airflow + dbt + PostgreSQL', text:'데이터 ETL 파이프라인 (Airflow + dbt + PostgreSQL).\nDAG 설계, 원천 추출, dbt 변환/테스트, 증분 로드, 알림(Slack), 데이터 품질 체크.' },
    { label:'Prefect + Polars', text:'Prefect 2 워크플로 + Polars 고성능 변환.\n비동기 태스크, 재시도/알림, Polars DataFrame 처리, Snowflake/BigQuery 적재, UI 대시보드.' },
    { label:'Spark + Kafka 실시간', text:'Apache Spark Streaming + Kafka 실시간 ETL.\n스트림 처리, 윈도우 집계, Delta Lake 저장, 스키마 레지스트리, Grafana 모니터링.' },
  ],
  analytics: [
    { label:'Python + Streamlit', text:'데이터 분석 대시보드 (Python + Streamlit).\nPandas/Polars 처리, Plotly 인터랙티브 차트, 날짜 필터, CSV/Excel 내보내기, 도커 배포.' },
    { label:'Observable Framework', text:'Observable Framework 정적 데이터 앱.\nDuckDB 인브라우저 쿼리, Plot 차트, 자동 빌드/배포, 마크다운 노트북 스타일.' },
    { label:'Evidence + DuckDB', text:'Evidence BI 툴 + DuckDB SQL 분석.\n마크다운 기반 리포트, SQL 블록, 자동 차트, 팀 공유, Git 기반 버전 관리.' },
  ],
  automation: [
    { label:'Playwright 브라우저 자동화', text:'Playwright 기반 업무 자동화 봇.\n로그인 자동화, 폼 제출, 데이터 추출, 스케줄 실행(APScheduler), 슬랙/이메일 알림.' },
    { label:'n8n 워크플로 자동화', text:'n8n 셀프호스팅 워크플로 자동화.\nAPI 연동 노드, 웹훅 트리거, AI 노드(Claude), 조건 분기, 에러 처리, 도커 배포.' },
    { label:'Python + RPA (pyautogui)', text:'Python RPA 데스크탑 자동화 (pyautogui + pytesseract).\n화면 인식, 클릭/타이핑 자동화, OCR 데이터 추출, 스케줄러, 로그 리포트.' },
  ],
  cicd: [
    { label:'GitHub Actions + Docker', text:'GitHub Actions CI/CD 파이프라인.\n자동 테스트, Docker 빌드/푸시(GHCR), 스테이징 배포(SSH), 프로덕션 승인 워크플로, 슬랙 알림.' },
    { label:'GitLab CI + K8s', text:'GitLab CI/CD + Kubernetes 배포 파이프라인.\nMulti-stage 파이프라인, Helm 차트, ArgoCD GitOps, 롤백, 환경별 설정 관리.' },
    { label:'Dagger + Tekton', text:'Dagger 프로그래머블 CI + Tekton 파이프라인.\n컨테이너 네이티브 빌드, 재사용 가능 모듈, 멀티클라우드 배포, 캐시 최적화.' },
  ],
  monitoring: [
    { label:'Prometheus + Grafana', text:'서버 모니터링 스택 (Prometheus + Grafana + Alertmanager).\n커스텀 메트릭, 알림 룰, 슬랙/이메일 알림, 로그 집계(Loki), 도커 컴포즈 배포.' },
    { label:'OpenTelemetry + Jaeger', text:'분산 추적 시스템 (OpenTelemetry + Jaeger).\n자동 계측, 트레이스/스팬, 서비스 맵, 슬로우 쿼리 감지, Grafana Tempo 통합.' },
    { label:'Sentry + UptimeRobot', text:'에러 트래킹 + 업타임 모니터링 (Sentry SDK + UptimeRobot).\n소스맵, 성능 트래킹, 알림 채널, 자동 이슈 생성(GitHub), 인시던트 대응 런북.' },
  ],
  game: [
    { label:'Unity 2D 플랫포머', text:'Unity 6 2D 플랫포머 게임.\n플레이어 이동/점프(Input System), Tilemap, 적 AI(NavMesh2D), 세이브 시스템, Google Play 배포.' },
    { label:'Unity 3D 모바일 게임', text:'Unity 3D 하이퍼캐주얼 모바일 게임.\n물리 기반 게임플레이, 광고(AdMob), 인앱결제, 리더보드(Google Play), iOS/Android 빌드.' },
    { label:'Godot 4 인디 게임', text:'Godot 4 (GDScript) 인디 게임.\n씬 트리 설계, 애니메이션, 파티클, 사운드 버스, Steam SDK 연동, itch.io 배포.' },
  ],
  webgame: [
    { label:'Phaser 3 + TypeScript', text:'Phaser 3 + TypeScript 브라우저 게임.\n게임 루프, 스프라이트/애니메이션, 물리(Matter.js), 점수 저장(localStorage), 모바일 터치.' },
    { label:'Three.js + Cannon.js', text:'Three.js 3D 웹 게임 + Cannon.js 물리.\n3D 씬, 충돌 감지, 파티클, GLTF 모델, 포스트 프로세싱, WebGL 최적화 필요.' },
    { label:'Kaboom.js (2D 게임)', text:'Kaboom.js 2D 액션 게임.\n씬 관리, 스프라이트 시트, 타일맵(Tiled), 사운드(Howler), 랭킹 API, Netlify 배포.' },
  ],
  discord: [
    { label:'discord.py + Claude AI', text:'Discord 봇 (discord.py 2.x + Claude API).\n슬래시 커맨드, AI 대화, 역할 자동 부여, 공지 예약, 로그 채널, Replit 배포.' },
    { label:'discord.js + 음악봇', text:'Discord 음악 봇 (discord.js v14 + DisTube).\nYouTube/Spotify 재생, 큐 관리, 볼륨/효과, 슬래시 커맨드, Railway 배포.' },
    { label:'discord.py + 서버 관리', text:'Discord 서버 관리 봇 (discord.py).\n자동 모더레이션, 스팸 감지, 신고 시스템, 통계 대시보드, MongoDB 로그 저장.' },
  ],
  slack: [
    { label:'Slack Bolt + Claude AI', text:'Slack AI 어시스턴트 앱 (Bolt for Python + Claude).\n앱 멘션 응답, 슬래시 커맨드, 모달 UI, 스레드 요약, 채널 요약, Socket Mode.' },
    { label:'Slack Bolt + 워크플로', text:'Slack 업무 자동화 앱 (Bolt + Workflow Steps).\n승인 워크플로, 알림 봇, Jira/GitHub 연동, 블록 킷 UI, Heroku 배포.' },
    { label:'Slack + 온콜 봇', text:'온콜 알림 & 인시던트 관리 Slack 봇.\nPagerDuty 연동, 알림 라우팅, 에스컬레이션, 포스트모템 템플릿, 상태 업데이트 자동화.' },
  ],
  telegram: [
    { label:'python-telegram-bot + AI', text:'Telegram AI 챗봇 (python-telegram-bot 21.x + Claude).\n커맨드 핸들러, 대화 상태 머신(ConversationHandler), 인라인 버튼, 파일 처리, 웹훅 배포.' },
    { label:'Telegram 채널 봇', text:'Telegram 채널 자동 포스팅 봇.\nRSS/뉴스 수집, AI 요약, 예약 발송, 미디어 포함, 구독자 관리, Cron 스케줄.' },
    { label:'Telegram 미니앱 (TWA)', text:'Telegram Web App(TWA) + FastAPI 백엔드.\n미니앱 UI(React), Telegram 인증, TON 결제, 게임/설문/스토어, VPS 배포.' },
  ],
  saas: [
    { label:'Next.js + Stripe Billing', text:'SaaS 구독 플랫폼 (Next.js 15 + Stripe).\nFreemium 플랜, 사용량 제한, Stripe Customer Portal, 팀/멤버 관리, 이메일(Resend), Vercel.' },
    { label:'Supabase + Lemon Squeezy', text:'Supabase 기반 SaaS (Next.js + Lemon Squeezy).\nRLS 보안, Auth, 구독 관리, 웹훅, 라이선스 키, 글로벌 판매(세금 처리 포함).' },
    { label:'Laravel + Cashier', text:'Laravel SaaS 스타터 (Cashier + Stripe + Filament).\n구독/플랜, 인보이스, 어드민 패널, 멀티테넌시, Horizon 큐, Forge 배포.' },
  ],
  blog: [
    { label:'Next.js + MDX + Velite', text:'Next.js 15 블로그 (Velite + MDX + Tailwind Typography).\n마크다운 포스트, 코드 하이라이팅(Shiki), 태그, RSS, OG 이미지 생성, Vercel 배포.' },
    { label:'Astro Content Collections', text:'Astro Content Collections 블로그.\n타입세이프 콘텐츠, 마크다운/MDX, 드래프트, 태그, 사이트맵, RSS, 빠른 빌드 최적화.' },
    { label:'Ghost CMS + 커스텀 테마', text:'Ghost CMS 헤드리스 + Next.js 프론트엔드.\nGhost Content API, 뉴스레터(내장), 멤버십, 결제, 커스텀 테마, 관리자 UI.' },
  ],
  coding: [
    { label:'Judge0 기반 채점 서버', text:'코딩 테스트 플랫폼 (Next.js + Judge0 API).\n코드 에디터(Monaco), 다중 언어 채점, 테스트 케이스, 시간/메모리 제한, 풀이 히스토리.' },
    { label:'LeetCode 클론 (풀스택)', text:'LeetCode 스타일 OJ (Next.js + Rust 샌드박스).\n문제 CRUD, 코드 실행 샌드박스, 통계, 랭킹, 태그/난이도 필터, Redis 큐잉.' },
    { label:'AI 코딩 튜터', text:'AI 코딩 튜터 서비스 (Next.js + Claude API).\n문제 추천, 힌트 생성, 코드 리뷰, 개념 설명, 진도 추적, 스트릭 시스템.' },
  ],
  openapi: [
    { label:'TypeScript SDK 자동 생성', text:'OpenAPI 스펙 → TypeScript SDK 자동 생성 도구.\n스키마 파싱(openapi-typescript), 타입 생성, fetch 래퍼, 문서 사이트, CLI 패키지 배포.' },
    { label:'Swagger UI + Mock 서버', text:'OpenAPI 기반 인터랙티브 문서 + Mock 서버.\nSwagger UI 커스텀, Prism Mock, 예제 자동 생성, 테스트 슈트 자동화, GitHub Pages 배포.' },
    { label:'API 게이트웨이 설정 생성', text:'OpenAPI → Kong/Nginx API 게이트웨이 설정 자동 생성.\n라우팅 규칙, 인증 플러그인, rate limit, CORS, 설정 검증 CLI 도구.' },
  ],
};

// 카테고리별 템플릿 (실행마다 셔플됨)
const HOME_TEMPLATES_RAW = [
  // ── 웹/풀스택 ──
  { key:'webapp',    icon:'🌐', label:'웹앱',          text:'Next.js + FastAPI 기반 웹앱.\n사용자 인증(JWT), CRUD API, 실시간 알림(WebSocket) 기능 필요.' },
  { key:'landing',   icon:'🎯', label:'랜딩페이지',    text:'제품 랜딩 페이지 (Astro + TailwindCSS).\n히어로 섹션, 가격표, FAQ, 뉴스레터 구독, 빠른 로딩 필요.' },
  { key:'dashboard', icon:'📊', label:'대시보드',      text:'관리자 대시보드 (React + Recharts).\n실시간 차트, 사용자 통계, 데이터 필터링/내보내기, 권한 관리 필요.' },
  { key:'ecommerce', icon:'🛒', label:'이커머스',      text:'이커머스 플랫폼 (Next.js + Stripe).\n상품 목록/상세, 장바구니, 결제, 주문 관리, 재고 추적 필요.' },
  { key:'forum',     icon:'💬', label:'커뮤니티 포럼', text:'개발자 커뮤니티 포럼 (Next.js + PostgreSQL).\n게시글/댓글, 마크다운 에디터, 태그, 검색, 좋아요, 포인트 시스템 필요.' },
  { key:'portfolio', icon:'🎨', label:'포트폴리오',    text:'개발자 포트폴리오 사이트 (Next.js + Framer Motion).\n프로젝트 갤러리, 스킬 섹션, 블로그, 다크모드, SEO 최적화 필요.' },
  // ── 백엔드/API ──
  { key:'api',       icon:'⚙️', label:'API 서버',      text:'REST API 서버 (Python FastAPI).\n인증(JWT/OAuth2), rate limiting, PostgreSQL 연동, OpenAPI 문서 자동 생성 필요.' },
  { key:'graphql',   icon:'🔗', label:'GraphQL API',   text:'GraphQL API 서버 (Node.js + Apollo Server).\n스키마 설계, 리졸버, 인증 미들웨어, 데이터로더(N+1 방지), 구독 필요.' },
  { key:'microservice', icon:'🧩', label:'마이크로서비스', text:'마이크로서비스 아키텍처 (Python + Docker).\n서비스 분리, API 게이트웨이, 메시지 큐(RabbitMQ), 서비스 디스커버리 필요.' },
  { key:'auth',      icon:'🔐', label:'인증 시스템',   text:'인증/인가 서비스 (Node.js).\nJWT + refresh token, OAuth2 소셜 로그인(Google/GitHub), RBAC, 이메일 인증 필요.' },
  // ── 모바일 ──
  { key:'mobile',    icon:'📱', label:'모바일 앱',     text:'React Native 모바일 앱.\n소셜 로그인, 푸시 알림, 오프라인 지원, 앱스토어 배포 설정 필요.' },
  { key:'pwa',       icon:'📲', label:'PWA',           text:'Progressive Web App (Next.js).\n오프라인 지원(Service Worker), 설치 가능, 푸시 알림, 앱 아이콘, 빠른 로딩 필요.' },
  // ── 데스크탑/CLI/툴 ──
  { key:'cli',       icon:'⌨️', label:'CLI 도구',      text:'CLI 도구 (Python).\n인자 파싱(Click), 설정 파일, 플러그인 시스템, 자동완성, PyPI 패키지 배포 포함.' },
  { key:'desktop',   icon:'🖥️', label:'데스크탑 앱',   text:'데스크탑 앱 (Electron + React).\n네이티브 메뉴, 파일 시스템 접근, 자동 업데이터, 트레이 아이콘, 크로스플랫폼 빌드 필요.' },
  { key:'vscode',    icon:'🧩', label:'VSCode 확장',   text:'VSCode 확장 프로그램 (TypeScript).\n커맨드 팔레트, 사이드바 웹뷰, 언어 서버 연동, 설정 스키마, 마켓플레이스 배포 필요.' },
  { key:'chrome',    icon:'🔌', label:'Chrome 확장',   text:'Chrome 확장 프로그램 (Manifest V3).\n현재 페이지 분석, 팝업 UI, 백그라운드 서비스 워커, 콘텐츠 스크립트, 설정 저장 필요.' },
  // ── AI/ML ──
  { key:'chatbot',   icon:'🤖', label:'AI 챗봇',       text:'AI 챗봇 서비스 (Python + Claude API).\n멀티턴 대화, 시스템 프롬프트 커스텀, 스트리밍 응답, 대화 히스토리 저장, 웹 UI 필요.' },
  { key:'ml',        icon:'🧠', label:'ML 파이프라인', text:'ML 학습 파이프라인 (Python + PyTorch).\n데이터 전처리, 모델 훈련, 실험 추적(MLflow), 평가, 모델 서빙(FastAPI) 포함.' },
  { key:'rag',       icon:'📚', label:'RAG 시스템',    text:'RAG(검색 증강 생성) 시스템 (Python + LangChain).\n문서 임베딩, 벡터DB(Chroma), 하이브리드 검색, Claude 연동, 웹 UI 필요.' },
  { key:'agent',     icon:'🕵️', label:'AI 에이전트',   text:'자율 AI 에이전트 (Python + Claude API).\n도구 사용(웹검색/코드실행/파일), 계획 수립, 멀티에이전트 협업, 태스크 자동화 필요.' },
  // ── 데이터/자동화 ──
  { key:'scraper',   icon:'🕷️', label:'웹 크롤러',     text:'웹 크롤러 / 데이터 수집 파이프라인.\nPlaywright 기반 동적 페이지 크롤링, 스케줄러(APScheduler), DB 저장, 중복 제거 필요.' },
  { key:'etl',       icon:'🔄', label:'ETL 파이프라인', text:'데이터 ETL 파이프라인 (Python + Airflow).\n다중 소스 수집(API/DB/파일), 변환/정제, 적재, 스케줄링, 모니터링 대시보드 필요.' },
  { key:'analytics', icon:'📈', label:'데이터 분석',   text:'데이터 분석 & 시각화 플랫폼 (Python + Streamlit).\nPandas 데이터 처리, 인터랙티브 차트, 필터링, 리포트 생성, 배포 필요.' },
  { key:'automation',icon:'⚡', label:'업무 자동화',   text:'업무 자동화 봇 (Python + Selenium/Playwright).\n반복 웹 작업 자동화, 이메일/슬랙 알림, 스케줄 실행, 오류 재시도 로직 필요.' },
  // ── DevOps/인프라 ──
  { key:'cicd',      icon:'🚀', label:'CI/CD 파이프라인', text:'CI/CD 파이프라인 (GitHub Actions + Docker).\n자동 테스트, 빌드, 도커 이미지 빌드/푸시, 스테이징/프로덕션 배포, 슬랙 알림 필요.' },
  { key:'monitoring',icon:'🔍', label:'모니터링 시스템', text:'서버 모니터링 & 알림 시스템 (Python + Prometheus).\n메트릭 수집, Grafana 대시보드, 임계값 알림(이메일/슬랙), 로그 분석 필요.' },
  // ── 게임/엔터테인먼트 ──
  { key:'game',      icon:'🎮', label:'게임 개발',      text:'Unity 기반 2D 플랫포머 게임.\n플레이어 이동/점프, 적 AI, 스테이지 클리어, 사운드 시스템, Google Play 배포 필요.' },
  { key:'webgame',   icon:'🕹️', label:'웹 게임',        text:'브라우저 게임 (TypeScript + Phaser 3).\n게임 루프, 스프라이트/애니메이션, 물리 엔진, 점수 저장, 모바일 터치 지원 필요.' },
  // ── 커뮤니케이션/협업 ──
  { key:'discord',   icon:'🤖', label:'Discord 봇',    text:'Discord 봇 (discord.py).\n슬래시 커맨드, 역할 자동 부여, 공지 예약, 로그 채널, GPT/Claude 연동 기능 필요.' },
  { key:'slack',     icon:'💼', label:'Slack 앱',       text:'Slack 앱 (Python + Bolt).\n슬래시 커맨드, 모달 UI, 블록 킷, 이벤트 핸들링, Workflow Step, 알림 봇 기능 필요.' },
  { key:'telegram',  icon:'✈️', label:'Telegram 봇',   text:'Telegram 봇 (Python + python-telegram-bot).\n커맨드 핸들러, 인라인 키보드, 결제, 그룹 관리, AI 연동, 웹훅 배포 필요.' },
  // ── 기타 실용 ──
  { key:'saas',      icon:'💳', label:'SaaS 서비스',   text:'SaaS 구독 서비스 (Next.js + Stripe).\n플랜별 기능 제한, 결제/구독 관리, 팀 대시보드, 이메일 온보딩, Stripe Billing 필요.' },
  { key:'blog',      icon:'✍️', label:'개인 블로그',   text:'개인 블로그 사이트 (Next.js + MDX).\n마크다운 포스트, 태그/카테고리, 댓글(giscus), SEO/OG 메타태그, RSS 피드 필요.' },
  { key:'coding',    icon:'🏆', label:'코딩 테스트',   text:'코딩 테스트 준비 플랫폼.\n문제 풀이 환경(Python/JS), 온라인 채점 서버, 시간·메모리 측정, 풀이 히스토리 저장 필요.' },
  { key:'openapi',   icon:'📝', label:'OpenAPI 래퍼',  text:'OpenAPI 스펙 기반 SDK 자동 생성 + 문서화 도구.\n스키마 파싱, 타입스크립트 타입 생성, 인터랙티브 문서 사이트, CLI 도구 필요.' },
];

// 셔플 유틸
function _shuffleArray(arr){
  const a=[...arr];
  for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}
  return a;
}

// 실행마다 셔플된 순서로 적용
const HOME_TEMPLATES = {};
const HOME_BUTTONS_ORDER = _shuffleArray(HOME_TEMPLATES_RAW);
HOME_BUTTONS_ORDER.forEach(t=>{ HOME_TEMPLATES[t.key]=t.text; });
