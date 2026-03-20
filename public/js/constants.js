// ── 전역 상태 관리 (AppState) ──────────────────────────────────────────────────
window.AppState = {
  activeProjectId: null,
  homeFiles: [],
  homeCwd: '',
  homeMode: 'planning', // 'planning' | 'refactoring' | 'enhancement'
  spawnSummary: '',
  spawnRootCwd: '',
  spawnDefaultName: '',
  spawnPrereqs: [],
  spawnDesignFiles: [], // {name, isImage, bytes:ArrayBuffer, mimeType}
};

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
    { label_ko:'Next.js 15 + FastAPI', label_en:'Next.js 15 + FastAPI', text_ko:'Next.js 15 App Router + FastAPI 풀스택 웹앱.\n사용자 인증(NextAuth v5), Server Actions, Shadcn UI, PostgreSQL(Drizzle ORM), 실시간 알림(SSE) 필요.', text_en:'Next.js 15 App Router + FastAPI full-stack web app.\nUser auth (NextAuth v5), Server Actions, Shadcn UI, PostgreSQL (Drizzle ORM), real-time notifications (SSE) required.' },
    { label_ko:'React + Hono (엣지)', label_en:'React + Hono (Edge)', text_ko:'React SPA + Hono 엣지 API (Cloudflare Workers).\nD1 DB, KV 캐시, JWT 인증, Zod 검증, Wrangler 배포 필요.', text_en:'React SPA + Hono edge API (Cloudflare Workers).\nD1 DB, KV cache, JWT auth, Zod validation, Wrangler deployment required.' },
    { label_ko:'T3 Stack (풀스택 타입세이프)', label_en:'T3 Stack (Full-stack Typesafe)', text_ko:'T3 Stack (Next.js + tRPC + Prisma + Tailwind).\n타입세이프 API, 세션 인증(NextAuth), Supabase DB, Vercel 배포 필요.', text_en:'T3 Stack (Next.js + tRPC + Prisma + Tailwind).\nTypesafe API, session auth (NextAuth), Supabase DB, Vercel deployment required.' },
    { label_ko:'SvelteKit + Bun', label_en:'SvelteKit + Bun', text_ko:'SvelteKit + Bun 백엔드 풀스택 앱.\nForm actions, Lucia 인증, SQLite(LibSQL), 서버사이드 렌더링, Fly.io 배포 필요.', text_en:'SvelteKit + Bun backend full-stack app.\nForm actions, Lucia auth, SQLite (LibSQL), server-side rendering, Fly.io deployment required.' },
  ],
  landing: [
    { label_ko:'Astro + TailwindCSS', label_en:'Astro + TailwindCSS', text_ko:'Astro 5 기반 제품 랜딩 페이지.\n히어로 섹션, 가격표, FAQ, 뉴스레터(Resend), 애니메이션(Motion), Core Web Vitals 100점 목표.', text_en:'Astro 5 product landing page.\nHero section, pricing table, FAQ, newsletter (Resend), animations (Motion), Core Web Vitals 100 target.' },
    { label_ko:'Next.js + Framer Motion', label_en:'Next.js + Framer Motion', text_ko:'Next.js + Framer Motion 랜딩 페이지.\n스크롤 애니메이션, 3D 카드, 파티클 배경, CTA 버튼, A/B 테스트(Vercel) 포함.', text_en:'Next.js + Framer Motion landing page.\nScroll animations, 3D cards, particle background, CTA buttons, A/B testing (Vercel) included.' },
    { label_ko:'정적 HTML + GSAP', label_en:'Static HTML + GSAP', text_ko:'순수 HTML/CSS/JS + GSAP 스크롤 애니메이션 랜딩.\n번들 제로, CDN 배포, Lighthouse 100점, 뉴스레터 폼(Formspree) 포함.', text_en:'Pure HTML/CSS/JS + GSAP scroll animation landing.\nZero bundle, CDN deployment, Lighthouse 100, newsletter form (Formspree) included.' },
  ],
  dashboard: [
    { label_ko:'React + Recharts + Shadcn', label_en:'React + Recharts + Shadcn', text_ko:'React 관리자 대시보드 (Shadcn/ui + Recharts).\n실시간 차트, 날짜 필터, CSV 내보내기, 다크모드, 반응형, RBAC 권한 관리 필요.', text_en:'React admin dashboard (Shadcn/ui + Recharts).\nReal-time charts, date filter, CSV export, dark mode, responsive, RBAC required.' },
    { label_ko:'Next.js + Tremor', label_en:'Next.js + Tremor', text_ko:'Next.js App Router + Tremor UI 대시보드.\nServer Components로 차트 렌더, Prisma + PostgreSQL, 팀/역할 관리, Vercel Analytics 연동.', text_en:'Next.js App Router + Tremor UI dashboard.\nServer Components chart rendering, Prisma + PostgreSQL, team/role management, Vercel Analytics integration.' },
    { label_ko:'Vue 3 + ECharts', label_en:'Vue 3 + ECharts', text_ko:'Vue 3 Composition API + Apache ECharts 대시보드.\n실시간 웹소켓 데이터, 커스텀 테마, 드래그 레이아웃(Vue Draggable), FastAPI 백엔드.', text_en:'Vue 3 Composition API + Apache ECharts dashboard.\nReal-time WebSocket data, custom theme, drag layout (Vue Draggable), FastAPI backend.' },
  ],
  ecommerce: [
    { label_ko:'Next.js + Stripe', label_en:'Next.js + Stripe', text_ko:'Next.js 15 이커머스 (Stripe Checkout + Webhooks).\n상품 목록/상세/장바구니, 결제, 주문 추적, 재고 관리, Stripe Customer Portal 필요.', text_en:'Next.js 15 e-commerce (Stripe Checkout + Webhooks).\nProduct listing/detail/cart, checkout, order tracking, inventory management, Stripe Customer Portal required.' },
    { label_ko:'Medusa.js (헤드리스)', label_en:'Medusa.js (Headless)', text_ko:'Medusa.js 헤드리스 커머스 + Next.js 스토어프론트.\n플러그인 아키텍처, 다중 통화, 할인 쿠폰, 어드민 대시보드, Stripe/PayPal 지원.', text_en:'Medusa.js headless commerce + Next.js storefront.\nPlugin architecture, multi-currency, discount coupons, admin dashboard, Stripe/PayPal support.' },
    { label_ko:'Shopify Hydrogen', label_en:'Shopify Hydrogen', text_ko:'Shopify Hydrogen (React) 커스텀 스토어프론트.\nShopify Storefront API, 서버 컴포넌트, 캐싱 전략, Analytics, Oxygen 배포 필요.', text_en:'Shopify Hydrogen (React) custom storefront.\nShopify Storefront API, server components, caching strategy, Analytics, Oxygen deployment required.' },
  ],
  forum: [
    { label_ko:'Next.js + PostgreSQL', label_en:'Next.js + PostgreSQL', text_ko:'개발자 커뮤니티 포럼 (Next.js + PostgreSQL).\n게시글/댓글, 마크다운 에디터(Tiptap), 태그, 검색(Fuse.js), 좋아요, 포인트 시스템 필요.', text_en:'Developer community forum (Next.js + PostgreSQL).\nPosts/comments, markdown editor (Tiptap), tags, search (Fuse.js), likes, point system required.' },
    { label_ko:'Discourse-like (Node.js)', label_en:'Discourse-like (Node.js)', text_ko:'Discourse 스타일 포럼 (Node.js + Redis + PostgreSQL).\n실시간 알림(Socket.io), 이메일 다이제스트, 뱃지/신뢰 레벨, 풀텍스트 검색 필요.', text_en:'Discourse-style forum (Node.js + Redis + PostgreSQL).\nReal-time notifications (Socket.io), email digest, badges/trust levels, full-text search required.' },
    { label_ko:'Flarum 스타일 SPA', label_en:'Flarum-style SPA', text_ko:'SPA 포럼 (Vue 3 + Laravel API).\nJSON:API 스펙, 무한 스크롤, 태그 필터, 멘션/알림, 이메일 인증, OAuth 소셜 로그인.', text_en:'SPA forum (Vue 3 + Laravel API).\nJSON:API spec, infinite scroll, tag filter, mentions/notifications, email verification, OAuth social login.' },
  ],
  portfolio: [
    { label_ko:'Next.js + Framer Motion', label_en:'Next.js + Framer Motion', text_ko:'개발자 포트폴리오 (Next.js 15 + Framer Motion).\n3D 카드 갤러리, 블로그(MDX), 다크모드, SEO, OG 이미지 자동 생성, Vercel 배포.', text_en:'Developer portfolio (Next.js 15 + Framer Motion).\n3D card gallery, blog (MDX), dark mode, SEO, OG image auto-generation, Vercel deployment.' },
    { label_ko:'Astro + Three.js', label_en:'Astro + Three.js', text_ko:'Astro + Three.js 인터랙티브 포트폴리오.\n3D 배경 씬, 스크롤 트리거 애니메이션, 작업물 갤러리, 이력서 PDF 생성 필요.', text_en:'Astro + Three.js interactive portfolio.\n3D background scene, scroll-trigger animations, work gallery, resume PDF generation required.' },
    { label_ko:'Gatsby + Contentful', label_en:'Gatsby + Contentful', text_ko:'Gatsby + Contentful CMS 포트폴리오.\nGraphQL 데이터 레이어, ISR, 프로젝트 CMS 관리, Algolia 검색, PWA 설정 포함.', text_en:'Gatsby + Contentful CMS portfolio.\nGraphQL data layer, ISR, project CMS management, Algolia search, PWA setup included.' },
  ],
  api: [
    { label_ko:'FastAPI + PostgreSQL', label_en:'FastAPI + PostgreSQL', text_ko:'REST API 서버 (Python FastAPI + PostgreSQL).\nJWT 인증, rate limiting(slowapi), Alembic 마이그레이션, OpenAPI 자동 문서, 도커 배포.', text_en:'REST API server (Python FastAPI + PostgreSQL).\nJWT auth, rate limiting (slowapi), Alembic migrations, OpenAPI auto-docs, Docker deployment.' },
    { label_ko:'Hono + Bun (엣지 API)', label_en:'Hono + Bun (Edge API)', text_ko:'Hono + Bun 초고속 REST API.\nZod 검증, Bearer 인증, SQLite(LibSQL), 테스트(Vitest), Cloudflare Workers 배포 가능.', text_en:'Hono + Bun ultra-fast REST API.\nZod validation, Bearer auth, SQLite (LibSQL), testing (Vitest), Cloudflare Workers deployable.' },
    { label_ko:'NestJS + Prisma', label_en:'NestJS + Prisma', text_ko:'NestJS 엔터프라이즈 API (TypeScript + Prisma + PostgreSQL).\n모듈 아키텍처, Guards/Interceptors, Swagger, Redis 캐싱, Jest 테스트, 도커 컴포즈.', text_en:'NestJS enterprise API (TypeScript + Prisma + PostgreSQL).\nModular architecture, Guards/Interceptors, Swagger, Redis caching, Jest tests, Docker Compose.' },
  ],
  graphql: [
    { label_ko:'Apollo Server + Prisma', label_en:'Apollo Server + Prisma', text_ko:'GraphQL API (Apollo Server 4 + Prisma + PostgreSQL).\n스키마 퍼스트 설계, DataLoader, JWT 인증, 실시간 Subscription, Nexus 타입 생성.', text_en:'GraphQL API (Apollo Server 4 + Prisma + PostgreSQL).\nSchema-first design, DataLoader, JWT auth, real-time Subscription, Nexus type generation.' },
    { label_ko:'Pothos + Hono', label_en:'Pothos + Hono', text_ko:'Pothos(코드 퍼스트 GraphQL) + Hono 서버.\n타입세이프 리졸버, Drizzle ORM, 인증 플러그인, Relay 페이지네이션, Bun 런타임.', text_en:'Pothos (code-first GraphQL) + Hono server.\nTypesafe resolvers, Drizzle ORM, auth plugin, Relay pagination, Bun runtime.' },
    { label_ko:'Hasura (자동 GraphQL)', label_en:'Hasura (Auto GraphQL)', text_ko:'Hasura + PostgreSQL 자동 GraphQL API.\n즉시 CRUD, 퍼미션 룰, 커스텀 Action, Event Trigger, Remote Schema, Subscription 포함.', text_en:'Hasura + PostgreSQL auto GraphQL API.\nInstant CRUD, permission rules, custom Actions, Event Triggers, Remote Schema, Subscriptions included.' },
  ],
  microservice: [
    { label_ko:'Python + Docker + RabbitMQ', label_en:'Python + Docker + RabbitMQ', text_ko:'마이크로서비스 (Python FastAPI + Docker Compose + RabbitMQ).\n서비스 분리, API 게이트웨이(Nginx), 메시지 큐, 서비스 디스커버리, 분산 트레이싱.', text_en:'Microservices (Python FastAPI + Docker Compose + RabbitMQ).\nService separation, API gateway (Nginx), message queue, service discovery, distributed tracing.' },
    { label_ko:'Node.js + Kafka', label_en:'Node.js + Kafka', text_ko:'Node.js 마이크로서비스 + Apache Kafka 이벤트 스트리밍.\n도메인 분리, 이벤트 소싱, CQRS 패턴, Kubernetes 배포, Jaeger 트레이싱 필요.', text_en:'Node.js microservices + Apache Kafka event streaming.\nDomain separation, event sourcing, CQRS pattern, Kubernetes deployment, Jaeger tracing required.' },
    { label_ko:'Go + gRPC', label_en:'Go + gRPC', text_ko:'Go 마이크로서비스 + gRPC 통신.\nProtobuf 스키마, 서비스 메시(Consul), 회로차단기(Hystrix), Prometheus 메트릭, K8s Helm 차트.', text_en:'Go microservices + gRPC communication.\nProtobuf schema, service mesh (Consul), circuit breaker (Hystrix), Prometheus metrics, K8s Helm charts.' },
  ],
  auth: [
    { label_ko:'JWT + OAuth2 (Node.js)', label_en:'JWT + OAuth2 (Node.js)', text_ko:'인증 서비스 (Node.js + Passport.js).\nJWT + refresh token rotation, OAuth2(Google/GitHub/Kakao), RBAC, 이메일 인증, MFA(TOTP).', text_en:'Auth service (Node.js + Passport.js).\nJWT + refresh token rotation, OAuth2 (Google/GitHub/Kakao), RBAC, email verification, MFA (TOTP).' },
    { label_ko:'Better Auth (TypeScript)', label_en:'Better Auth (TypeScript)', text_ko:'Better Auth 풀스택 인증 라이브러리 통합.\n소셜 로그인, 세션 관리, 2FA, 마법 링크, 조직/멤버 관리, Next.js App Router 연동.', text_en:'Better Auth full-stack auth library integration.\nSocial login, session management, 2FA, magic link, org/member management, Next.js App Router integration.' },
    { label_ko:'Keycloak + Spring', label_en:'Keycloak + Spring', text_ko:'Keycloak IAM + Spring Security 인증 시스템.\nSSO, SAML/OIDC, 사용자 연합, 어드민 UI, Realm 설정 자동화, 도커 배포 포함.', text_en:'Keycloak IAM + Spring Security auth system.\nSSO, SAML/OIDC, user federation, admin UI, Realm auto-configuration, Docker deployment included.' },
  ],
  mobile: [
    { label_ko:'React Native + Expo', label_en:'React Native + Expo', text_ko:'React Native(Expo SDK 52) 모바일 앱.\n소셜 로그인(expo-auth-session), 푸시 알림(FCM/APNs), 오프라인(MMKV), EAS Build 배포.', text_en:'React Native (Expo SDK 52) mobile app.\nSocial login (expo-auth-session), push notifications (FCM/APNs), offline (MMKV), EAS Build deployment.' },
    { label_ko:'Flutter (크로스플랫폼)', label_en:'Flutter (Cross-platform)', text_ko:'Flutter 크로스플랫폼 앱 (iOS/Android).\nRiverpod 상태관리, GoRouter, Firebase Auth + Firestore, 로컬 알림, Play Store/App Store 배포.', text_en:'Flutter cross-platform app (iOS/Android).\nRiverpod state management, GoRouter, Firebase Auth + Firestore, local notifications, Play Store/App Store deployment.' },
    { label_ko:'Capacitor + Ionic', label_en:'Capacitor + Ionic', text_ko:'Ionic + Capacitor 하이브리드 앱 (Angular/React 기반).\n네이티브 플러그인, 카메라/GPS, 오프라인 PWA, Appflow CI/CD, 두 플랫폼 동시 배포.', text_en:'Ionic + Capacitor hybrid app (Angular/React).\nNative plugins, camera/GPS, offline PWA, Appflow CI/CD, dual-platform deployment.' },
  ],
  pwa: [
    { label_ko:'Next.js PWA', label_en:'Next.js PWA', text_ko:'Next.js 15 PWA (next-pwa + Service Worker).\n오프라인 캐싱 전략, 설치 프롬프트, 백그라운드 싱크, 푸시 알림, Web App Manifest.', text_en:'Next.js 15 PWA (next-pwa + Service Worker).\nOffline caching strategy, install prompt, background sync, push notifications, Web App Manifest.' },
    { label_ko:'Vite + Workbox', label_en:'Vite + Workbox', text_ko:'Vite + Workbox PWA.\n커스텀 Service Worker, 선제적 캐싱, IndexedDB 오프라인 스토리지, 업데이트 알림 UI.', text_en:'Vite + Workbox PWA.\nCustom Service Worker, pre-caching, IndexedDB offline storage, update notification UI.' },
    { label_ko:'SvelteKit PWA', label_en:'SvelteKit PWA', text_ko:'SvelteKit PWA (vite-plugin-pwa).\n완전 오프라인 지원, 캐시 전략, 설치 가능, 앱 아이콘 생성, Lighthouse PWA 체크리스트 충족.', text_en:'SvelteKit PWA (vite-plugin-pwa).\nFull offline support, cache strategy, installable, app icon generation, Lighthouse PWA checklist compliance.' },
  ],
  cli: [
    { label_ko:'Python + Click', label_en:'Python + Click', text_ko:'Python CLI 도구 (Click + Rich).\n서브커맨드, 설정 파일(TOML), 플러그인 시스템, Rich 프로그레스바, 자동완성, PyPI 배포.', text_en:'Python CLI tool (Click + Rich).\nSubcommands, config file (TOML), plugin system, Rich progress bar, auto-completion, PyPI deployment.' },
    { label_ko:'Node.js + Commander', label_en:'Node.js + Commander', text_ko:'Node.js CLI (Commander + Inquirer + Chalk).\n인터랙티브 프롬프트, 설정 파일(cosmiconfig), 자동완성 스크립트, npm 패키지 배포.', text_en:'Node.js CLI (Commander + Inquirer + Chalk).\nInteractive prompts, config file (cosmiconfig), auto-completion scripts, npm package deployment.' },
    { label_ko:'Rust + Clap', label_en:'Rust + Clap', text_ko:'Rust CLI 도구 (Clap + Indicatif).\n파싱 성능, 서브커맨드, 설정(TOML), 크로스컴파일, GitHub Actions 릴리즈 바이너리 배포.', text_en:'Rust CLI tool (Clap + Indicatif).\nParsing performance, subcommands, config (TOML), cross-compilation, GitHub Actions release binary deployment.' },
  ],
  desktop: [
    { label_ko:'Tauri 2 + React', label_en:'Tauri 2 + React', text_ko:'Tauri 2 + React 데스크탑 앱.\n네이티브 메뉴, 파일 시스템(Rust 백엔드), 자동 업데이터, 트레이 아이콘, macOS/Windows/Linux 빌드.', text_en:'Tauri 2 + React desktop app.\nNative menu, file system (Rust backend), auto-updater, tray icon, macOS/Windows/Linux builds.' },
    { label_ko:'Electron + React', label_en:'Electron + React', text_ko:'Electron + React 데스크탑 앱.\nipcMain/ipcRenderer, 네이티브 다이얼로그, 자동 업데이터(electron-updater), Squirrel 인스톨러.', text_en:'Electron + React desktop app.\nipcMain/ipcRenderer, native dialogs, auto-updater (electron-updater), Squirrel installer.' },
    { label_ko:'Flutter Desktop', label_en:'Flutter Desktop', text_ko:'Flutter 데스크탑 앱 (Windows + macOS).\n네이티브 플러그인, 파일 시스템, 시스템 트레이, 자동 업데이터, MSIX/DMG 패키저.', text_en:'Flutter desktop app (Windows + macOS).\nNative plugins, file system, system tray, auto-updater, MSIX/DMG packager.' },
  ],
  vscode: [
    { label_ko:'Language Server + 웹뷰', label_en:'Language Server + Webview', text_ko:'VSCode 확장 (TypeScript) + Language Server Protocol.\n커맨드 팔레트, 사이드바 웹뷰(React), 코드 렌즈, LSP 진단, 마켓플레이스 배포.', text_en:'VSCode extension (TypeScript) + Language Server Protocol.\nCommand palette, sidebar webview (React), CodeLens, LSP diagnostics, marketplace deployment.' },
    { label_ko:'AI 코드 어시스턴트', label_en:'AI Code Assistant', text_ko:'VSCode AI 코드 어시스턴트 확장.\nInline Completions API, GitHub Copilot Chat 참여자, Claude API 연동, 스트리밍 응답.', text_en:'VSCode AI code assistant extension.\nInline Completions API, GitHub Copilot Chat participant, Claude API integration, streaming responses.' },
    { label_ko:'Git 워크플로 툴', label_en:'Git Workflow Tool', text_ko:'VSCode Git 워크플로 확장.\nSource Control Provider, Tree View, Quick Pick, Webview 패널, GitHub API 연동, 단축키 설정.', text_en:'VSCode Git workflow extension.\nSource Control Provider, Tree View, Quick Pick, Webview panel, GitHub API integration, keybinding setup.' },
  ],
  chrome: [
    { label_ko:'Manifest V3 기본', label_en:'Manifest V3 Basic', text_ko:'Chrome 확장 (MV3 + React 팝업).\n서비스 워커, 콘텐츠 스크립트, 현재 페이지 DOM 분석, chrome.storage, 웹스토어 배포.', text_en:'Chrome extension (MV3 + React popup).\nService worker, content script, current page DOM analysis, chrome.storage, Web Store deployment.' },
    { label_ko:'AI 페이지 요약', label_en:'AI Page Summary', text_ko:'AI 페이지 요약 Chrome 확장 (MV3 + Claude API).\n콘텐츠 추출, 사이드패널 UI, 스트리밍 요약, API 키 관리, 하이라이트 기능 포함.', text_en:'AI page summary Chrome extension (MV3 + Claude API).\nContent extraction, side panel UI, streaming summary, API key management, highlight feature included.' },
    { label_ko:'생산성 트래커', label_en:'Productivity Tracker', text_ko:'생산성 & 시간 추적 Chrome 확장.\n사이트별 시간 측정, 일간 리포트 차트, 차단 목록, chrome.alarms, IndexedDB 데이터 저장.', text_en:'Productivity & time tracking Chrome extension.\nPer-site time measurement, daily report charts, block list, chrome.alarms, IndexedDB data storage.' },
  ],
  chatbot: [
    { label_ko:'Claude API + FastAPI', label_en:'Claude API + FastAPI', text_ko:'Claude API 스트리밍 챗봇 서비스.\n멀티턴 대화, 시스템 프롬프트 커스텀, 파일 업로드(PDF/이미지), 대화 저장, Next.js 웹 UI.', text_en:'Claude API streaming chatbot service.\nMulti-turn conversation, custom system prompt, file upload (PDF/image), chat history, Next.js web UI.' },
    { label_ko:'RAG 챗봇 (LangChain)', label_en:'RAG Chatbot (LangChain)', text_ko:'RAG 기반 지식베이스 챗봇 (Python + LangChain + Claude).\n문서 임베딩(OpenAI/Voyage), Pinecone 벡터 검색, 출처 인용, 웹 크롤링 인덱서.', text_en:'RAG knowledge base chatbot (Python + LangChain + Claude).\nDocument embedding (OpenAI/Voyage), Pinecone vector search, source citation, web crawling indexer.' },
    { label_ko:'멀티에이전트 어시스턴트', label_en:'Multi-Agent Assistant', text_ko:'멀티에이전트 AI 어시스턴트 (Claude Agent SDK).\n플래닝 에이전트, 실행 에이전트, 검증 에이전트 분리, 도구 사용(웹검색/코드실행), 메모리 관리.', text_en:'Multi-agent AI assistant (Claude Agent SDK).\nPlanning agent, execution agent, verification agent separation, tool use (web search/code execution), memory management.' },
  ],
  ml: [
    { label_ko:'PyTorch + MLflow', label_en:'PyTorch + MLflow', text_ko:'ML 훈련 파이프라인 (PyTorch + MLflow).\n데이터 전처리(Pandas), 모델 정의, 실험 추적, 하이퍼파라미터 튜닝(Optuna), FastAPI 서빙.', text_en:'ML training pipeline (PyTorch + MLflow).\nData preprocessing (Pandas), model definition, experiment tracking, hyperparameter tuning (Optuna), FastAPI serving.' },
    { label_ko:'HuggingFace 파인튜닝', label_en:'HuggingFace Fine-tuning', text_ko:'HuggingFace Transformers LLM 파인튜닝.\nQLoRA/LoRA, Trainer API, 데이터셋 준비, W&B 트래킹, VLLM 추론 서버 배포.', text_en:'HuggingFace Transformers LLM fine-tuning.\nQLoRA/LoRA, Trainer API, dataset preparation, W&B tracking, VLLM inference server deployment.' },
    { label_ko:'scikit-learn + Streamlit', label_en:'scikit-learn + Streamlit', text_ko:'머신러닝 분류/회귀 파이프라인 (scikit-learn).\n피처 엔지니어링, 교차검증, SHAP 해석, Streamlit 데모 UI, Docker 패키징.', text_en:'ML classification/regression pipeline (scikit-learn).\nFeature engineering, cross-validation, SHAP interpretation, Streamlit demo UI, Docker packaging.' },
  ],
  rag: [
    { label_ko:'LangChain + Chroma + Claude', label_en:'LangChain + Chroma + Claude', text_ko:'RAG 시스템 (LangChain + Chroma + Claude).\n문서 청킹, 임베딩, 하이브리드 검색(BM25+벡터), 리랭킹, 출처 인용, FastAPI + 웹 UI.', text_en:'RAG system (LangChain + Chroma + Claude).\nDocument chunking, embedding, hybrid search (BM25+vector), re-ranking, source citation, FastAPI + web UI.' },
    { label_ko:'LlamaIndex + Pinecone', label_en:'LlamaIndex + Pinecone', text_ko:'LlamaIndex 기반 기업 지식 검색 시스템.\n멀티 문서 인덱스, 쿼리 라우팅, 서브쿼리 분해, Pinecone 벡터 DB, 평가(RAGAS) 포함.', text_en:'LlamaIndex enterprise knowledge search system.\nMulti-document index, query routing, sub-query decomposition, Pinecone vector DB, evaluation (RAGAS) included.' },
    { label_ko:'pgvector + PostgREST', label_en:'pgvector + PostgREST', text_ko:'pgvector + PostgreSQL 기반 RAG.\n서버리스 임베딩(Supabase Edge), 코사인 유사도, RLS 보안, REST API 자동 생성.', text_en:'pgvector + PostgreSQL based RAG.\nServerless embedding (Supabase Edge), cosine similarity, RLS security, REST API auto-generation.' },
  ],
  agent: [
    { label_ko:'Claude Agent SDK 멀티에이전트', label_en:'Claude Agent SDK Multi-Agent', text_ko:'Claude Agent SDK 멀티에이전트 시스템.\n오케스트레이터 + 서브에이전트 분리, 도구 정의, 병렬 실행, 상태 공유, 이벤트 스트리밍.', text_en:'Claude Agent SDK multi-agent system.\nOrchestrator + sub-agent separation, tool definitions, parallel execution, state sharing, event streaming.' },
    { label_ko:'LangGraph 워크플로', label_en:'LangGraph Workflow', text_ko:'LangGraph 기반 자율 에이전트 워크플로.\n상태 그래프, 조건부 엣지, 도구(웹검색/코드실행/파일), 사람-개입(HIL), 체크포인트 저장.', text_en:'LangGraph autonomous agent workflow.\nState graph, conditional edges, tools (web search/code execution/file), human-in-the-loop (HIL), checkpoints.' },
    { label_ko:'AutoGen 협업 에이전트', label_en:'AutoGen Collaborative Agents', text_ko:'AutoGen 멀티에이전트 협업 시스템.\n어시스턴트/사용자 에이전트, 코드 실행 환경, 그룹 채팅, 역할 분담, 비용 트래킹.', text_en:'AutoGen multi-agent collaboration system.\nAssistant/user agents, code execution environment, group chat, role assignment, cost tracking.' },
  ],
  scraper: [
    { label_ko:'Playwright + APScheduler', label_en:'Playwright + APScheduler', text_ko:'Playwright 기반 동적 크롤러 + 스케줄러.\n로그인 자동화, 페이지네이션, 데이터 정제(BeautifulSoup), PostgreSQL 저장, 중복 제거.', text_en:'Playwright dynamic crawler + scheduler.\nLogin automation, pagination, data cleaning (BeautifulSoup), PostgreSQL storage, deduplication.' },
    { label_ko:'Scrapy + Redis 분산', label_en:'Scrapy + Redis Distributed', text_ko:'Scrapy 분산 크롤러 (scrapy-redis + Splash).\n분산 큐, JS 렌더링, 프록시 로테이션, 스로틀링, Elasticsearch 저장, Scrapyd 배포.', text_en:'Scrapy distributed crawler (scrapy-redis + Splash).\nDistributed queue, JS rendering, proxy rotation, throttling, Elasticsearch storage, Scrapyd deployment.' },
    { label_ko:'Crawlee (Node.js)', label_en:'Crawlee (Node.js)', text_ko:'Crawlee (Apify) Node.js 크롤러.\nPlaywright + Cheerio 하이브리드, 자동 스케일링, 세션 풀, 지문 위장, 데이터셋 내보내기.', text_en:'Crawlee (Apify) Node.js crawler.\nPlaywright + Cheerio hybrid, auto-scaling, session pool, fingerprint spoofing, dataset export.' },
  ],
  etl: [
    { label_ko:'Airflow + dbt + PostgreSQL', label_en:'Airflow + dbt + PostgreSQL', text_ko:'데이터 ETL 파이프라인 (Airflow + dbt + PostgreSQL).\nDAG 설계, 원천 추출, dbt 변환/테스트, 증분 로드, 알림(Slack), 데이터 품질 체크.', text_en:'Data ETL pipeline (Airflow + dbt + PostgreSQL).\nDAG design, source extraction, dbt transform/test, incremental load, Slack alerts, data quality checks.' },
    { label_ko:'Prefect + Polars', label_en:'Prefect + Polars', text_ko:'Prefect 2 워크플로 + Polars 고성능 변환.\n비동기 태스크, 재시도/알림, Polars DataFrame 처리, Snowflake/BigQuery 적재, UI 대시보드.', text_en:'Prefect 2 workflow + Polars high-performance transforms.\nAsync tasks, retry/alerts, Polars DataFrame processing, Snowflake/BigQuery loading, UI dashboard.' },
    { label_ko:'Spark + Kafka 실시간', label_en:'Spark + Kafka Real-time', text_ko:'Apache Spark Streaming + Kafka 실시간 ETL.\n스트림 처리, 윈도우 집계, Delta Lake 저장, 스키마 레지스트리, Grafana 모니터링.', text_en:'Apache Spark Streaming + Kafka real-time ETL.\nStream processing, window aggregation, Delta Lake storage, schema registry, Grafana monitoring.' },
  ],
  analytics: [
    { label_ko:'Python + Streamlit', label_en:'Python + Streamlit', text_ko:'데이터 분석 대시보드 (Python + Streamlit).\nPandas/Polars 처리, Plotly 인터랙티브 차트, 날짜 필터, CSV/Excel 내보내기, 도커 배포.', text_en:'Data analysis dashboard (Python + Streamlit).\nPandas/Polars processing, Plotly interactive charts, date filter, CSV/Excel export, Docker deployment.' },
    { label_ko:'Observable Framework', label_en:'Observable Framework', text_ko:'Observable Framework 정적 데이터 앱.\nDuckDB 인브라우저 쿼리, Plot 차트, 자동 빌드/배포, 마크다운 노트북 스타일.', text_en:'Observable Framework static data app.\nDuckDB in-browser query, Plot charts, auto build/deploy, markdown notebook style.' },
    { label_ko:'Evidence + DuckDB', label_en:'Evidence + DuckDB', text_ko:'Evidence BI 툴 + DuckDB SQL 분석.\n마크다운 기반 리포트, SQL 블록, 자동 차트, 팀 공유, Git 기반 버전 관리.', text_en:'Evidence BI tool + DuckDB SQL analysis.\nMarkdown-based reports, SQL blocks, auto charts, team sharing, Git-based version control.' },
  ],
  automation: [
    { label_ko:'Playwright 브라우저 자동화', label_en:'Playwright Browser Automation', text_ko:'Playwright 기반 업무 자동화 봇.\n로그인 자동화, 폼 제출, 데이터 추출, 스케줄 실행(APScheduler), 슬랙/이메일 알림.', text_en:'Playwright task automation bot.\nLogin automation, form submission, data extraction, scheduled execution (APScheduler), Slack/email alerts.' },
    { label_ko:'n8n 워크플로 자동화', label_en:'n8n Workflow Automation', text_ko:'n8n 셀프호스팅 워크플로 자동화.\nAPI 연동 노드, 웹훅 트리거, AI 노드(Claude), 조건 분기, 에러 처리, 도커 배포.', text_en:'n8n self-hosted workflow automation.\nAPI integration nodes, webhook triggers, AI node (Claude), conditional branching, error handling, Docker deployment.' },
    { label_ko:'Python + RPA (pyautogui)', label_en:'Python + RPA (pyautogui)', text_ko:'Python RPA 데스크탑 자동화 (pyautogui + pytesseract).\n화면 인식, 클릭/타이핑 자동화, OCR 데이터 추출, 스케줄러, 로그 리포트.', text_en:'Python RPA desktop automation (pyautogui + pytesseract).\nScreen recognition, click/typing automation, OCR data extraction, scheduler, log reports.' },
  ],
  cicd: [
    { label_ko:'GitHub Actions + Docker', label_en:'GitHub Actions + Docker', text_ko:'GitHub Actions CI/CD 파이프라인.\n자동 테스트, Docker 빌드/푸시(GHCR), 스테이징 배포(SSH), 프로덕션 승인 워크플로, 슬랙 알림.', text_en:'GitHub Actions CI/CD pipeline.\nAuto testing, Docker build/push (GHCR), staging deploy (SSH), production approval workflow, Slack alerts.' },
    { label_ko:'GitLab CI + K8s', label_en:'GitLab CI + K8s', text_ko:'GitLab CI/CD + Kubernetes 배포 파이프라인.\nMulti-stage 파이프라인, Helm 차트, ArgoCD GitOps, 롤백, 환경별 설정 관리.', text_en:'GitLab CI/CD + Kubernetes deployment pipeline.\nMulti-stage pipeline, Helm charts, ArgoCD GitOps, rollback, environment-based config management.' },
    { label_ko:'Dagger + Tekton', label_en:'Dagger + Tekton', text_ko:'Dagger 프로그래머블 CI + Tekton 파이프라인.\n컨테이너 네이티브 빌드, 재사용 가능 모듈, 멀티클라우드 배포, 캐시 최적화.', text_en:'Dagger programmable CI + Tekton pipeline.\nContainer-native build, reusable modules, multi-cloud deploy, cache optimization.' },
  ],
  monitoring: [
    { label_ko:'Prometheus + Grafana', label_en:'Prometheus + Grafana', text_ko:'서버 모니터링 스택 (Prometheus + Grafana + Alertmanager).\n커스텀 메트릭, 알림 룰, 슬랙/이메일 알림, 로그 집계(Loki), 도커 컴포즈 배포.', text_en:'Server monitoring stack (Prometheus + Grafana + Alertmanager).\nCustom metrics, alert rules, Slack/email alerts, log aggregation (Loki), Docker Compose deployment.' },
    { label_ko:'OpenTelemetry + Jaeger', label_en:'OpenTelemetry + Jaeger', text_ko:'분산 추적 시스템 (OpenTelemetry + Jaeger).\n자동 계측, 트레이스/스팬, 서비스 맵, 슬로우 쿼리 감지, Grafana Tempo 통합.', text_en:'Distributed tracing system (OpenTelemetry + Jaeger).\nAuto-instrumentation, traces/spans, service map, slow query detection, Grafana Tempo integration.' },
    { label_ko:'Sentry + UptimeRobot', label_en:'Sentry + UptimeRobot', text_ko:'에러 트래킹 + 업타임 모니터링 (Sentry SDK + UptimeRobot).\n소스맵, 성능 트래킹, 알림 채널, 자동 이슈 생성(GitHub), 인시던트 대응 런북.', text_en:'Error tracking + uptime monitoring (Sentry SDK + UptimeRobot).\nSource maps, performance tracking, alert channels, auto issue creation (GitHub), incident response runbook.' },
  ],
  game: [
    { label_ko:'Unity 2D 플랫포머', label_en:'Unity 2D Platformer', text_ko:'Unity 6 2D 플랫포머 게임.\n플레이어 이동/점프(Input System), Tilemap, 적 AI(NavMesh2D), 세이브 시스템, Google Play 배포.', text_en:'Unity 6 2D platformer game.\nPlayer movement/jump (Input System), Tilemap, enemy AI (NavMesh2D), save system, Google Play deployment.' },
    { label_ko:'Unity 3D 모바일 게임', label_en:'Unity 3D Mobile Game', text_ko:'Unity 3D 하이퍼캐주얼 모바일 게임.\n물리 기반 게임플레이, 광고(AdMob), 인앱결제, 리더보드(Google Play), iOS/Android 빌드.', text_en:'Unity 3D hyper-casual mobile game.\nPhysics-based gameplay, ads (AdMob), in-app purchases, leaderboard (Google Play), iOS/Android builds.' },
    { label_ko:'Godot 4 인디 게임', label_en:'Godot 4 Indie Game', text_ko:'Godot 4 (GDScript) 인디 게임.\n씬 트리 설계, 애니메이션, 파티클, 사운드 버스, Steam SDK 연동, itch.io 배포.', text_en:'Godot 4 (GDScript) indie game.\nScene tree design, animations, particles, sound bus, Steam SDK integration, itch.io deployment.' },
  ],
  webgame: [
    { label_ko:'Phaser 3 + TypeScript', label_en:'Phaser 3 + TypeScript', text_ko:'Phaser 3 + TypeScript 브라우저 게임.\n게임 루프, 스프라이트/애니메이션, 물리(Matter.js), 점수 저장(localStorage), 모바일 터치.', text_en:'Phaser 3 + TypeScript browser game.\nGame loop, sprites/animation, physics (Matter.js), score saving (localStorage), mobile touch.' },
    { label_ko:'Three.js + Cannon.js', label_en:'Three.js + Cannon.js', text_ko:'Three.js 3D 웹 게임 + Cannon.js 물리.\n3D 씬, 충돌 감지, 파티클, GLTF 모델, 포스트 프로세싱, WebGL 최적화 필요.', text_en:'Three.js 3D web game + Cannon.js physics.\n3D scene, collision detection, particles, GLTF models, post-processing, WebGL optimization required.' },
    { label_ko:'Kaboom.js (2D 게임)', label_en:'Kaboom.js (2D Game)', text_ko:'Kaboom.js 2D 액션 게임.\n씬 관리, 스프라이트 시트, 타일맵(Tiled), 사운드(Howler), 랭킹 API, Netlify 배포.', text_en:'Kaboom.js 2D action game.\nScene management, sprite sheets, tilemap (Tiled), sound (Howler), ranking API, Netlify deployment.' },
  ],
  discord: [
    { label_ko:'discord.py + Claude AI', label_en:'discord.py + Claude AI', text_ko:'Discord 봇 (discord.py 2.x + Claude API).\n슬래시 커맨드, AI 대화, 역할 자동 부여, 공지 예약, 로그 채널, Replit 배포.', text_en:'Discord bot (discord.py 2.x + Claude API).\nSlash commands, AI conversation, auto role assignment, scheduled announcements, log channel, Replit deployment.' },
    { label_ko:'discord.js + 음악봇', label_en:'discord.js + Music Bot', text_ko:'Discord 음악 봇 (discord.js v14 + DisTube).\nYouTube/Spotify 재생, 큐 관리, 볼륨/효과, 슬래시 커맨드, Railway 배포.', text_en:'Discord music bot (discord.js v14 + DisTube).\nYouTube/Spotify playback, queue management, volume/effects, slash commands, Railway deployment.' },
    { label_ko:'discord.py + 서버 관리', label_en:'discord.py + Server Admin', text_ko:'Discord 서버 관리 봇 (discord.py).\n자동 모더레이션, 스팸 감지, 신고 시스템, 통계 대시보드, MongoDB 로그 저장.', text_en:'Discord server management bot (discord.py).\nAuto moderation, spam detection, report system, stats dashboard, MongoDB log storage.' },
  ],
  slack: [
    { label_ko:'Slack Bolt + Claude AI', label_en:'Slack Bolt + Claude AI', text_ko:'Slack AI 어시스턴트 앱 (Bolt for Python + Claude).\n앱 멘션 응답, 슬래시 커맨드, 모달 UI, 스레드 요약, 채널 요약, Socket Mode.', text_en:'Slack AI assistant app (Bolt for Python + Claude).\nApp mention responses, slash commands, modal UI, thread summary, channel summary, Socket Mode.' },
    { label_ko:'Slack Bolt + 워크플로', label_en:'Slack Bolt + Workflow', text_ko:'Slack 업무 자동화 앱 (Bolt + Workflow Steps).\n승인 워크플로, 알림 봇, Jira/GitHub 연동, 블록 킷 UI, Heroku 배포.', text_en:'Slack task automation app (Bolt + Workflow Steps).\nApproval workflow, notification bot, Jira/GitHub integration, Block Kit UI, Heroku deployment.' },
    { label_ko:'Slack + 온콜 봇', label_en:'Slack + On-call Bot', text_ko:'온콜 알림 & 인시던트 관리 Slack 봇.\nPagerDuty 연동, 알림 라우팅, 에스컬레이션, 포스트모템 템플릿, 상태 업데이트 자동화.', text_en:'On-call alert & incident management Slack bot.\nPagerDuty integration, alert routing, escalation, postmortem templates, status update automation.' },
  ],
  telegram: [
    { label_ko:'python-telegram-bot + AI', label_en:'python-telegram-bot + AI', text_ko:'Telegram AI 챗봇 (python-telegram-bot 21.x + Claude).\n커맨드 핸들러, 대화 상태 머신(ConversationHandler), 인라인 버튼, 파일 처리, 웹훅 배포.', text_en:'Telegram AI chatbot (python-telegram-bot 21.x + Claude).\nCommand handlers, conversation state machine (ConversationHandler), inline buttons, file handling, webhook deployment.' },
    { label_ko:'Telegram 채널 봇', label_en:'Telegram Channel Bot', text_ko:'Telegram 채널 자동 포스팅 봇.\nRSS/뉴스 수집, AI 요약, 예약 발송, 미디어 포함, 구독자 관리, Cron 스케줄.', text_en:'Telegram channel auto-posting bot.\nRSS/news collection, AI summary, scheduled delivery, media included, subscriber management, Cron schedule.' },
    { label_ko:'Telegram 미니앱 (TWA)', label_en:'Telegram Mini App (TWA)', text_ko:'Telegram Web App(TWA) + FastAPI 백엔드.\n미니앱 UI(React), Telegram 인증, TON 결제, 게임/설문/스토어, VPS 배포.', text_en:'Telegram Web App (TWA) + FastAPI backend.\nMini app UI (React), Telegram auth, TON payment, game/survey/store, VPS deployment.' },
  ],
  saas: [
    { label_ko:'Next.js + Stripe Billing', label_en:'Next.js + Stripe Billing', text_ko:'SaaS 구독 플랫폼 (Next.js 15 + Stripe).\nFreemium 플랜, 사용량 제한, Stripe Customer Portal, 팀/멤버 관리, 이메일(Resend), Vercel.', text_en:'SaaS subscription platform (Next.js 15 + Stripe).\nFreemium plans, usage limits, Stripe Customer Portal, team/member management, email (Resend), Vercel.' },
    { label_ko:'Supabase + Lemon Squeezy', label_en:'Supabase + Lemon Squeezy', text_ko:'Supabase 기반 SaaS (Next.js + Lemon Squeezy).\nRLS 보안, Auth, 구독 관리, 웹훅, 라이선스 키, 글로벌 판매(세금 처리 포함).', text_en:'Supabase-based SaaS (Next.js + Lemon Squeezy).\nRLS security, Auth, subscription management, webhooks, license keys, global sales (tax handling included).' },
    { label_ko:'Laravel + Cashier', label_en:'Laravel + Cashier', text_ko:'Laravel SaaS 스타터 (Cashier + Stripe + Filament).\n구독/플랜, 인보이스, 어드민 패널, 멀티테넌시, Horizon 큐, Forge 배포.', text_en:'Laravel SaaS starter (Cashier + Stripe + Filament).\nSubscriptions/plans, invoices, admin panel, multi-tenancy, Horizon queue, Forge deployment.' },
  ],
  blog: [
    { label_ko:'Next.js + MDX + Velite', label_en:'Next.js + MDX + Velite', text_ko:'Next.js 15 블로그 (Velite + MDX + Tailwind Typography).\n마크다운 포스트, 코드 하이라이팅(Shiki), 태그, RSS, OG 이미지 생성, Vercel 배포.', text_en:'Next.js 15 blog (Velite + MDX + Tailwind Typography).\nMarkdown posts, code highlighting (Shiki), tags, RSS, OG image generation, Vercel deployment.' },
    { label_ko:'Astro Content Collections', label_en:'Astro Content Collections', text_ko:'Astro Content Collections 블로그.\n타입세이프 콘텐츠, 마크다운/MDX, 드래프트, 태그, 사이트맵, RSS, 빠른 빌드 최적화.', text_en:'Astro Content Collections blog.\nTypesafe content, Markdown/MDX, drafts, tags, sitemap, RSS, fast build optimization.' },
    { label_ko:'Ghost CMS + 커스텀 테마', label_en:'Ghost CMS + Custom Theme', text_ko:'Ghost CMS 헤드리스 + Next.js 프론트엔드.\nGhost Content API, 뉴스레터(내장), 멤버십, 결제, 커스텀 테마, 관리자 UI.', text_en:'Ghost CMS headless + Next.js frontend.\nGhost Content API, newsletter (built-in), membership, payments, custom theme, admin UI.' },
  ],
  coding: [
    { label_ko:'Judge0 기반 채점 서버', label_en:'Judge0 Grading Server', text_ko:'코딩 테스트 플랫폼 (Next.js + Judge0 API).\n코드 에디터(Monaco), 다중 언어 채점, 테스트 케이스, 시간/메모리 제한, 풀이 히스토리.', text_en:'Coding test platform (Next.js + Judge0 API).\nCode editor (Monaco), multi-language grading, test cases, time/memory limits, solution history.' },
    { label_ko:'LeetCode 클론 (풀스택)', label_en:'LeetCode Clone (Full-stack)', text_ko:'LeetCode 스타일 OJ (Next.js + Rust 샌드박스).\n문제 CRUD, 코드 실행 샌드박스, 통계, 랭킹, 태그/난이도 필터, Redis 큐잉.', text_en:'LeetCode-style OJ (Next.js + Rust sandbox).\nProblem CRUD, code execution sandbox, stats, ranking, tag/difficulty filter, Redis queuing.' },
    { label_ko:'AI 코딩 튜터', label_en:'AI Coding Tutor', text_ko:'AI 코딩 튜터 서비스 (Next.js + Claude API).\n문제 추천, 힌트 생성, 코드 리뷰, 개념 설명, 진도 추적, 스트릭 시스템.', text_en:'AI coding tutor service (Next.js + Claude API).\nProblem recommendations, hint generation, code review, concept explanation, progress tracking, streak system.' },
  ],
  openapi: [
    { label_ko:'TypeScript SDK 자동 생성', label_en:'TypeScript SDK Auto-gen', text_ko:'OpenAPI 스펙 → TypeScript SDK 자동 생성 도구.\n스키마 파싱(openapi-typescript), 타입 생성, fetch 래퍼, 문서 사이트, CLI 패키지 배포.', text_en:'OpenAPI spec -> TypeScript SDK auto-generation tool.\nSchema parsing (openapi-typescript), type generation, fetch wrapper, docs site, CLI package deployment.' },
    { label_ko:'Swagger UI + Mock 서버', label_en:'Swagger UI + Mock Server', text_ko:'OpenAPI 기반 인터랙티브 문서 + Mock 서버.\nSwagger UI 커스텀, Prism Mock, 예제 자동 생성, 테스트 슈트 자동화, GitHub Pages 배포.', text_en:'OpenAPI interactive docs + Mock server.\nSwagger UI custom, Prism Mock, auto example generation, test suite automation, GitHub Pages deployment.' },
    { label_ko:'API 게이트웨이 설정 생성', label_en:'API Gateway Config Gen', text_ko:'OpenAPI → Kong/Nginx API 게이트웨이 설정 자동 생성.\n라우팅 규칙, 인증 플러그인, rate limit, CORS, 설정 검증 CLI 도구.', text_en:'OpenAPI -> Kong/Nginx API gateway config auto-generation.\nRouting rules, auth plugins, rate limit, CORS, config validation CLI tool.' },
  ],
  // ── 새 카테고리 ──
  realtime: [
    { label_ko:'Socket.io + Redis Pub/Sub', label_en:'Socket.io + Redis Pub/Sub', text_ko:'실시간 멀티룸 채팅 서버 (Node.js + Socket.io + Redis Pub/Sub).\n룸 입장/퇴장, 타이핑 인디케이터, 읽음 확인, 온라인 목록, 메시지 영속화(PostgreSQL), 수평 확장.', text_en:'Real-time multi-room chat server (Node.js + Socket.io + Redis Pub/Sub).\nRoom join/leave, typing indicator, read receipts, online list, message persistence (PostgreSQL), horizontal scaling.' },
    { label_ko:'WebRTC + SFU (mediasoup)', label_en:'WebRTC + SFU (mediasoup)', text_ko:'WebRTC 화상통화 플랫폼 (mediasoup SFU + React).\nP2P → SFU 전환, 화면 공유, 녹화(MediaRecorder), 룸 관리, TURN 서버(coturn), 도커 배포.', text_en:'WebRTC video call platform (mediasoup SFU + React).\nP2P -> SFU transition, screen sharing, recording (MediaRecorder), room management, TURN server (coturn), Docker deployment.' },
    { label_ko:'CRDT 협업 편집기', label_en:'CRDT Collaborative Editor', text_ko:'실시간 협업 텍스트 편집기 (Yjs CRDT + Hocuspocus 서버).\nConflict-free 동시편집, 사용자 커서 표시, 히스토리, Tiptap 에디터, 오프라인 동기화.', text_en:'Real-time collaborative text editor (Yjs CRDT + Hocuspocus server).\nConflict-free concurrent editing, user cursor display, history, Tiptap editor, offline sync.' },
    { label_ko:'LiveKit 영상 스트리밍', label_en:'LiveKit Video Streaming', text_ko:'LiveKit 기반 라이브 스트리밍 플랫폼 (Next.js + LiveKit SDK).\n송출자/시청자 구분, 채팅, 반응 이모지, 녹화, 클라우드 저장, 동시 시청자 수 표시.', text_en:'LiveKit live streaming platform (Next.js + LiveKit SDK).\nBroadcaster/viewer separation, chat, reaction emojis, recording, cloud storage, concurrent viewer count.' },
  ],
  devtools: [
    { label_ko:'GitHub App (Probot)', label_en:'GitHub App (Probot)', text_ko:'GitHub App (Probot + TypeScript).\nPR 자동 리뷰 댓글, 이슈 분류, 코드 오너 자동 지정, CI 상태 체크, Webhook 이벤트 처리.', text_en:'GitHub App (Probot + TypeScript).\nAuto PR review comments, issue classification, auto code owner assignment, CI status check, Webhook event handling.' },
    { label_ko:'Babel/ESLint 플러그인', label_en:'Babel/ESLint Plugin', text_ko:'커스텀 ESLint 플러그인 + Babel 변환 플러그인.\nAST 분석/조작, 코드 규칙 정의, 자동 수정(fixer), Jest 테스트, npm 배포, 문서 사이트.', text_en:'Custom ESLint plugin + Babel transform plugin.\nAST analysis/manipulation, code rule definitions, auto-fix (fixer), Jest tests, npm deployment, docs site.' },
    { label_ko:'Vite 플러그인', label_en:'Vite Plugin', text_ko:'Vite 빌드 플러그인 (TypeScript).\n커스텀 변환, 가상 모듈, HMR 지원, Rollup 호환, 옵션 스키마(Zod), 단위 테스트, npm 배포.', text_en:'Vite build plugin (TypeScript).\nCustom transforms, virtual modules, HMR support, Rollup compatible, options schema (Zod), unit tests, npm deployment.' },
    { label_ko:'코드 생성 CLI', label_en:'Code Generator CLI', text_ko:'코드 스캐폴딩 CLI 도구 (Node.js + Handlebars 템플릿).\n대화형 프롬프트(Inquirer), 템플릿 렌더링, Git 초기화, 의존성 설치, npx 즉시 실행 지원.', text_en:'Code scaffolding CLI tool (Node.js + Handlebars templates).\nInteractive prompts (Inquirer), template rendering, Git init, dependency install, npx instant execution support.' },
  ],
  infra: [
    { label_ko:'Terraform + AWS', label_en:'Terraform + AWS', text_ko:'AWS 인프라 IaC (Terraform + Terragrunt).\nVPC/서브넷, ECS Fargate, RDS Aurora, S3/CloudFront, IAM 최소권한, 환경별(dev/prod) 분리.', text_en:'AWS infrastructure IaC (Terraform + Terragrunt).\nVPC/subnets, ECS Fargate, RDS Aurora, S3/CloudFront, IAM least privilege, environment (dev/prod) separation.' },
    { label_ko:'Pulumi + GCP', label_en:'Pulumi + GCP', text_ko:'GCP 인프라 (Pulumi TypeScript + GKE).\nGKE 클러스터, Cloud SQL, Cloud Run, Secret Manager, Artifact Registry, CI/CD 연동.', text_en:'GCP infrastructure (Pulumi TypeScript + GKE).\nGKE cluster, Cloud SQL, Cloud Run, Secret Manager, Artifact Registry, CI/CD integration.' },
    { label_ko:'Ansible 서버 프로비저닝', label_en:'Ansible Server Provisioning', text_ko:'Ansible 서버 자동 프로비저닝 플레이북.\nOS 초기화, Nginx/SSL(Let\'s Encrypt), Docker 설치, 방화벽, 사용자 관리, 롤링 업데이트.', text_en:'Ansible server auto-provisioning playbooks.\nOS initialization, Nginx/SSL (Let\'s Encrypt), Docker install, firewall, user management, rolling updates.' },
    { label_ko:'Kubernetes Helm 차트', label_en:'Kubernetes Helm Charts', text_ko:'프로덕션 Kubernetes Helm 차트.\nDeployment/Service/Ingress, HPA 오토스케일, PV/PVC, ConfigMap/Secret, Liveness/Readiness 프로브.', text_en:'Production Kubernetes Helm charts.\nDeployment/Service/Ingress, HPA autoscale, PV/PVC, ConfigMap/Secret, Liveness/Readiness probes.' },
  ],
  security: [
    { label_ko:'취약점 스캐너 CLI', label_en:'Vulnerability Scanner CLI', text_ko:'웹 취약점 스캐너 CLI (Python + aiohttp).\nSQL Injection/XSS/CSRF 탐지, OWASP Top 10 체크리스트, 리포트 생성(HTML/JSON), 비동기 크롤링.', text_en:'Web vulnerability scanner CLI (Python + aiohttp).\nSQL Injection/XSS/CSRF detection, OWASP Top 10 checklist, report generation (HTML/JSON), async crawling.' },
    { label_ko:'패스워드 매니저', label_en:'Password Manager', text_ko:'로컬 패스워드 매니저 CLI + GUI (Python + Fernet 암호화).\nAES-256 암호화, 마스터 패스워드 PBKDF2, 클립보드 자동복사, 자동 잠금, 내보내기/가져오기.', text_en:'Local password manager CLI + GUI (Python + Fernet encryption).\nAES-256 encryption, master password PBKDF2, clipboard auto-copy, auto-lock, export/import.' },
    { label_ko:'보안 감사 대시보드', label_en:'Security Audit Dashboard', text_ko:'보안 감사 & 컴플라이언스 대시보드 (Next.js + Python).\nCVE 스캐닝(trivy), 의존성 취약점, SOC2/ISO 체크리스트, 자동 리포트, 알림 채널 연동.', text_en:'Security audit & compliance dashboard (Next.js + Python).\nCVE scanning (trivy), dependency vulnerabilities, SOC2/ISO checklist, auto-reports, alert channel integration.' },
    { label_ko:'제로트러스트 게이트웨이', label_en:'Zero Trust Gateway', text_ko:'제로트러스트 네트워크 게이트웨이 (Go + WireGuard).\n기기 인증, 정책 기반 접근제어, mTLS, 감사 로그, 관리 웹 UI, 클라우드 배포.', text_en:'Zero trust network gateway (Go + WireGuard).\nDevice auth, policy-based access control, mTLS, audit logs, admin web UI, cloud deployment.' },
  ],
  testing: [
    { label_ko:'E2E 테스트 프레임워크', label_en:'E2E Test Framework', text_ko:'E2E 테스트 자동화 프레임워크 (Playwright + TypeScript).\nPOM 패턴, 시각적 회귀(Percy), API 모킹, CI 통합, 병렬 실행, HTML 리포트 생성.', text_en:'E2E test automation framework (Playwright + TypeScript).\nPOM pattern, visual regression (Percy), API mocking, CI integration, parallel execution, HTML report generation.' },
    { label_ko:'성능 테스트 도구', label_en:'Performance Test Tool', text_ko:'웹 성능 & 부하 테스트 도구 (k6 + Grafana Cloud).\n시나리오 스크립트, 가상 사용자 램프업, P95/P99 지표, SLO 알림, 결과 시각화 대시보드.', text_en:'Web performance & load testing tool (k6 + Grafana Cloud).\nScenario scripts, virtual user ramp-up, P95/P99 metrics, SLO alerts, results visualization dashboard.' },
    { label_ko:'API 계약 테스트', label_en:'API Contract Testing', text_ko:'API 계약 테스트 (Pact + Jest + GitHub Actions).\nConsumer-Driven Contract, 브로커 서버, 제공자 검증, CD 파이프라인 통합, 계약 버전 관리.', text_en:'API contract testing (Pact + Jest + GitHub Actions).\nConsumer-Driven Contract, broker server, provider verification, CD pipeline integration, contract version management.' },
    { label_ko:'카오스 엔지니어링', label_en:'Chaos Engineering', text_ko:'카오스 엔지니어링 도구 (LitmusChaos + Kubernetes).\n장애 주입 시나리오, 네트워크 파티션, 파드 킬, 메모리/CPU 스파이크, 복구 검증, 리포트.', text_en:'Chaos engineering tool (LitmusChaos + Kubernetes).\nFault injection scenarios, network partition, pod kill, memory/CPU spike, recovery verification, reports.' },
  ],
  finance: [
    { label_ko:'개인 가계부 앱', label_en:'Personal Budget App', text_ko:'개인 가계부 웹앱 (Next.js + Prisma + PostgreSQL).\n수입/지출 입력, 카테고리 분류, 월별 차트, 예산 설정 및 초과 알림, CSV 가져오기/내보내기.', text_en:'Personal budget web app (Next.js + Prisma + PostgreSQL).\nIncome/expense input, category classification, monthly charts, budget setting & overspend alerts, CSV import/export.' },
    { label_ko:'암호화폐 트래커', label_en:'Crypto Tracker', text_ko:'암호화폐 포트폴리오 트래커 (React + CoinGecko API).\n실시간 가격(WebSocket), 보유량 입력, 수익률 계산, 가격 알림, 차트(TradingView Lightweight).', text_en:'Crypto portfolio tracker (React + CoinGecko API).\nReal-time prices (WebSocket), holdings input, return calculation, price alerts, charts (TradingView Lightweight).' },
    { label_ko:'인보이스 SaaS', label_en:'Invoice SaaS', text_ko:'인보이스 & 청구 SaaS (Next.js + Stripe + PDF).\n클라이언트 관리, 인보이스 생성, PDF 다운로드(Puppeteer), 결제 링크, 자동 리마인더, 세금 계산.', text_en:'Invoice & billing SaaS (Next.js + Stripe + PDF).\nClient management, invoice generation, PDF download (Puppeteer), payment links, auto reminders, tax calculation.' },
    { label_ko:'주식 스크리너', label_en:'Stock Screener', text_ko:'주식 스크리너 & 포트폴리오 분석 도구 (Python + FastAPI + Yahoo Finance).\n필터링(PER/PBR/배당), 백테스팅, 수익률 차트, 알림(이메일/슬랙), Streamlit 대시보드.', text_en:'Stock screener & portfolio analysis tool (Python + FastAPI + Yahoo Finance).\nFiltering (PE/PB/dividend), backtesting, return charts, alerts (email/Slack), Streamlit dashboard.' },
  ],
  health: [
    { label_ko:'헬스 트래커 앱', label_en:'Health Tracker App', text_ko:'운동/식단 헬스 트래커 (React Native + Expo).\n운동 로그, 영양소 분석(OpenFoodFacts API), 몸무게 추이 차트, 목표 설정, 알림 리마인더.', text_en:'Workout/diet health tracker (React Native + Expo).\nWorkout log, nutrition analysis (OpenFoodFacts API), weight trend charts, goal setting, alarm reminders.' },
    { label_ko:'의료 예약 시스템', label_en:'Medical Appointment System', text_ko:'병원 예약 & 진료 관리 시스템 (Next.js + PostgreSQL).\n의사/환자 관리, 캘린더 예약(FullCalendar), 대기열, 알림(SMS/이메일), HIPAA 고려 설계.', text_en:'Hospital appointment & care management system (Next.js + PostgreSQL).\nDoctor/patient management, calendar booking (FullCalendar), queue, alerts (SMS/email), HIPAA-compliant design.' },
    { label_ko:'명상 타이머 앱', label_en:'Meditation Timer App', text_ko:'명상 & 마음챙김 앱 (React Native + Expo AV).\n커스텀 타이머, 배경음악, 세션 기록, 연속 스트릭, 통계, 오프라인 지원, App Store 배포.', text_en:'Meditation & mindfulness app (React Native + Expo AV).\nCustom timer, background music, session log, streak, stats, offline support, App Store deployment.' },
    { label_ko:'칼로리 계산기 앱', label_en:'Calorie Calculator App', text_ko:'칼로리 & 영양 추적 앱 (Flutter + Firebase).\n바코드 스캔(ML Kit), 영양소 DB(OpenFoodFacts), 일일 목표, 섭취 히스토리, 리포트 생성.', text_en:'Calorie & nutrition tracking app (Flutter + Firebase).\nBarcode scan (ML Kit), nutrition DB (OpenFoodFacts), daily goals, intake history, report generation.' },
  ],
  edu: [
    { label_ko:'LMS (학습 관리 시스템)', label_en:'LMS (Learning Management)', text_ko:'온라인 학습 관리 시스템 (Next.js + Prisma + Mux).\n코스/레슨 CRUD, 동영상 업로드(Mux), 진도 추적, 퀴즈, 수료증(PDF), Stripe 결제 연동.', text_en:'Online learning management system (Next.js + Prisma + Mux).\nCourse/lesson CRUD, video upload (Mux), progress tracking, quizzes, certificates (PDF), Stripe payment integration.' },
    { label_ko:'플래시카드 앱', label_en:'Flashcard App', text_ko:'스마트 플래시카드 앱 (React Native + Expo).\nSRS 알고리즘(SM-2), 덱 관리, 이미지 카드, 오프라인, 공유 덱, iCloud 동기화, 학습 통계.', text_en:'Smart flashcard app (React Native + Expo).\nSRS algorithm (SM-2), deck management, image cards, offline, shared decks, iCloud sync, learning stats.' },
    { label_ko:'코딩 퀴즈 플랫폼', label_en:'Coding Quiz Platform', text_ko:'인터랙티브 코딩 퀴즈 플랫폼 (Next.js + Monaco Editor).\n언어별 문제, 실시간 채점, 힌트, 해설, 리더보드, 진도 뱃지, 클래스룸 기능.', text_en:'Interactive coding quiz platform (Next.js + Monaco Editor).\nLanguage-specific problems, real-time grading, hints, explanations, leaderboard, progress badges, classroom features.' },
    { label_ko:'AI 학습 튜터', label_en:'AI Learning Tutor', text_ko:'AI 개인 학습 튜터 (Next.js + Claude API + TTS).\n적응형 질문 생성, 오답 분석, 개념 설명(Socratic), 음성 대화, 학습 진도 리포트.', text_en:'AI personal learning tutor (Next.js + Claude API + TTS).\nAdaptive question generation, wrong answer analysis, concept explanation (Socratic), voice conversation, learning progress reports.' },
  ],
  map: [
    { label_ko:'Leaflet + OpenStreetMap', label_en:'Leaflet + OpenStreetMap', text_ko:'인터랙티브 지도 앱 (React + Leaflet + OpenStreetMap).\n커스텀 마커/클러스터, 레이어 토글, GeoJSON 렌더, 장소 검색(Nominatim), 경로 안내.', text_en:'Interactive map app (React + Leaflet + OpenStreetMap).\nCustom markers/clusters, layer toggle, GeoJSON rendering, place search (Nominatim), route directions.' },
    { label_ko:'Mapbox GL 여행 플래너', label_en:'Mapbox GL Travel Planner', text_ko:'여행 플래너 웹앱 (Next.js + Mapbox GL JS).\n여행 일정 지도 시각화, 핀 추가/메모, 경로 최적화, 공유 링크, 오프라인 타일 캐싱.', text_en:'Travel planner web app (Next.js + Mapbox GL JS).\nTrip itinerary map visualization, pin/notes, route optimization, sharing links, offline tile caching.' },
    { label_ko:'Google Maps 부동산', label_en:'Google Maps Real Estate', text_ko:'부동산 매물 지도 서비스 (React + Google Maps API).\n매물 마커/인포윈도우, 반경 필터, 지역별 통계 히트맵, 즐겨찾기, 비교 기능.', text_en:'Real estate map service (React + Google Maps API).\nProperty markers/info windows, radius filter, area stats heatmap, favorites, comparison feature.' },
    { label_ko:'배달 추적 실시간 지도', label_en:'Delivery Tracking Live Map', text_ko:'배달 실시간 위치 추적 (Next.js + Mapbox + Socket.io).\n배달원 위치 WebSocket 스트리밍, 경로 폴리라인, ETA 계산, 상태 업데이트, 고객 알림.', text_en:'Delivery real-time location tracking (Next.js + Mapbox + Socket.io).\nDriver location WebSocket streaming, route polyline, ETA calculation, status updates, customer notifications.' },
  ],
  media: [
    { label_ko:'영상 편집 웹앱', label_en:'Video Editor Web App', text_ko:'웹 기반 영상 편집기 (React + FFmpeg.wasm).\n클립 트림/병합, 자막 추가, 배경음악, 필터 효과, 진행률 표시, WebM/MP4 내보내기.', text_en:'Web-based video editor (React + FFmpeg.wasm).\nClip trim/merge, subtitle addition, background music, filter effects, progress display, WebM/MP4 export.' },
    { label_ko:'이미지 편집기', label_en:'Image Editor', text_ko:'온라인 이미지 편집기 (React + Konva.js).\n크롭/리사이즈, 필터, 텍스트 레이어, 스티커, 히스토리(undo/redo), PNG/JPG 내보내기.', text_en:'Online image editor (React + Konva.js).\nCrop/resize, filters, text layers, stickers, history (undo/redo), PNG/JPG export.' },
    { label_ko:'팟캐스트 플랫폼', label_en:'Podcast Platform', text_ko:'팟캐스트 호스팅 플랫폼 (Next.js + S3 + RSS).\n에피소드 업로드, RSS 자동 생성, 오디오 플레이어(wavesurfer.js), 구독, 통계, Spotify 제출.', text_en:'Podcast hosting platform (Next.js + S3 + RSS).\nEpisode upload, RSS auto-generation, audio player (wavesurfer.js), subscriptions, stats, Spotify submission.' },
    { label_ko:'AI 이미지 생성 갤러리', label_en:'AI Image Generation Gallery', text_ko:'AI 이미지 생성 & 갤러리 서비스 (Next.js + Replicate API).\n프롬프트 입력, Stable Diffusion 생성, 갤러리, 공개/비공개, 좋아요, 다운로드, 사용 한도.', text_en:'AI image generation & gallery service (Next.js + Replicate API).\nPrompt input, Stable Diffusion generation, gallery, public/private, likes, download, usage limits.' },
  ],
  iot: [
    { label_ko:'스마트홈 대시보드', label_en:'Smart Home Dashboard', text_ko:'스마트홈 IoT 대시보드 (Next.js + MQTT + InfluxDB).\n센서 실시간 모니터링, 자동화 룰(if-this-then-that), 알림, 기기 원격 제어, 에너지 분석.', text_en:'Smart home IoT dashboard (Next.js + MQTT + InfluxDB).\nReal-time sensor monitoring, automation rules (if-this-then-that), alerts, device remote control, energy analysis.' },
    { label_ko:'라즈베리파이 모니터링', label_en:'Raspberry Pi Monitoring', text_ko:'라즈베리파이 시스템 모니터 (Python + FastAPI + React).\nCPU/메모리/온도/디스크 실시간 수집, WebSocket 대시보드, 임계값 알림, 히스토리 차트.', text_en:'Raspberry Pi system monitor (Python + FastAPI + React).\nCPU/memory/temperature/disk real-time collection, WebSocket dashboard, threshold alerts, history charts.' },
    { label_ko:'농업 IoT 시스템', label_en:'Smart Agriculture IoT', text_ko:'스마트 농업 IoT 시스템 (Python + MQTT + InfluxDB).\n토양 수분/온도/조도 센서, 자동 관개, 예측(ML), Grafana 대시보드, 모바일 알림.', text_en:'Smart agriculture IoT system (Python + MQTT + InfluxDB).\nSoil moisture/temperature/light sensors, auto irrigation, prediction (ML), Grafana dashboard, mobile alerts.' },
    { label_ko:'에너지 모니터링', label_en:'Energy Monitoring', text_ko:'가정 에너지 모니터링 시스템 (FastAPI + TimescaleDB).\n전력 사용량 실시간 측정, 요금 계산, 기기별 분류, 태양광 발전 추적, 월별 리포트.', text_en:'Home energy monitoring system (FastAPI + TimescaleDB).\nReal-time power usage measurement, bill calculation, per-device classification, solar generation tracking, monthly reports.' },
  ],
  blockchain: [
    { label_ko:'ERC-20 토큰 + DApp', label_en:'ERC-20 Token + DApp', text_ko:'ERC-20 토큰 스마트 컨트랙트 + DApp (Solidity + Hardhat + React).\nOpenZeppelin, 민팅/소각, MetaMask 연동, ethers.js, Sepolia 테스트넷 배포, 감사 체크리스트.', text_en:'ERC-20 token smart contract + DApp (Solidity + Hardhat + React).\nOpenZeppelin, minting/burning, MetaMask integration, ethers.js, Sepolia testnet deployment, audit checklist.' },
    { label_ko:'NFT 마켓플레이스', label_en:'NFT Marketplace', text_ko:'NFT 민팅 & 거래 마켓플레이스 (Next.js + Solidity + IPFS).\nERC-721/1155, 민팅 UI, 경매/즉구, 로열티, Pinata IPFS 업로드, OpenSea 호환 메타데이터.', text_en:'NFT minting & trading marketplace (Next.js + Solidity + IPFS).\nERC-721/1155, minting UI, auction/buy now, royalties, Pinata IPFS upload, OpenSea compatible metadata.' },
    { label_ko:'DeFi 스테이킹 풀', label_en:'DeFi Staking Pool', text_ko:'DeFi 스테이킹 프로토콜 (Solidity + Foundry + React).\n스테이킹/언스테이킹, 리워드 계산, Foundry 테스트, 보안 감사(Slither), Arbitrum 배포.', text_en:'DeFi staking protocol (Solidity + Foundry + React).\nStaking/unstaking, reward calculation, Foundry tests, security audit (Slither), Arbitrum deployment.' },
    { label_ko:'DAO 거버넌스 시스템', label_en:'DAO Governance System', text_ko:'DAO 거버넌스 플랫폼 (Solidity + Governor + Snapshot).\n제안 생성/투표, 토큰 기반 의결권, 타임락, 실행 큐, Snapshot 오프체인 투표, 프론트엔드.', text_en:'DAO governance platform (Solidity + Governor + Snapshot).\nProposal creation/voting, token-based voting rights, timelock, execution queue, Snapshot off-chain voting, frontend.' },
  ],
  cms: [
    { label_ko:'헤드리스 CMS (Next.js + Sanity)', label_en:'Headless CMS (Next.js + Sanity)', text_ko:'헤드리스 CMS 기반 웹사이트 (Next.js + Sanity).\nSanity Studio 커스텀 스키마, GROQ 쿼리, ISR/On-demand Revalidation, 이미지 최적화, 미리보기.', text_en:'Headless CMS website (Next.js + Sanity).\nSanity Studio custom schema, GROQ queries, ISR/On-demand Revalidation, image optimization, preview.' },
    { label_ko:'Strapi + Next.js', label_en:'Strapi + Next.js', text_ko:'Strapi 헤드리스 CMS + Next.js 프론트엔드.\n콘텐츠 타입 빌더, REST/GraphQL API, 역할 권한, 미디어 라이브러리, i18n, VPS 배포.', text_en:'Strapi headless CMS + Next.js frontend.\nContent type builder, REST/GraphQL API, role permissions, media library, i18n, VPS deployment.' },
    { label_ko:'WordPress REST API 마이그레이션', label_en:'WordPress REST API Migration', text_ko:'WordPress → 헤드리스 마이그레이션 (WP REST API + Next.js).\n포스트/카테고리/태그 동기화, ACF 필드, Yoast SEO, 검색(Algolia), CDN 최적화.', text_en:'WordPress -> headless migration (WP REST API + Next.js).\nPost/category/tag sync, ACF fields, Yoast SEO, search (Algolia), CDN optimization.' },
    { label_ko:'Notion API 블로그', label_en:'Notion API Blog', text_ko:'Notion을 CMS로 사용하는 블로그 (Next.js + Notion API).\n페이지 블록 렌더링, ISR, 태그 필터, OG 이미지, 검색, RSS, Vercel 배포.', text_en:'Blog using Notion as CMS (Next.js + Notion API).\nPage block rendering, ISR, tag filter, OG images, search, RSS, Vercel deployment.' },
  ],
  email: [
    { label_ko:'이메일 뉴스레터 플랫폼', label_en:'Email Newsletter Platform', text_ko:'이메일 뉴스레터 플랫폼 (Next.js + Resend + React Email).\n구독/탈퇴 관리, 이메일 템플릿(React Email), 발송 스케줄, 오픈율/클릭률 추적, 세그먼트.', text_en:'Email newsletter platform (Next.js + Resend + React Email).\nSubscribe/unsubscribe management, email templates (React Email), send schedule, open/click rate tracking, segments.' },
    { label_ko:'트랜잭션 이메일 서비스', label_en:'Transactional Email Service', text_ko:'트랜잭션 이메일 발송 서비스 (Node.js + Nodemailer + Bull).\n이메일 큐(Bull+Redis), 재시도, 발송 로그, 템플릿 엔진(Handlebars), Webhook 이벤트.', text_en:'Transactional email service (Node.js + Nodemailer + Bull).\nEmail queue (Bull+Redis), retry, send logs, template engine (Handlebars), Webhook events.' },
    { label_ko:'이메일 파서 & 자동화', label_en:'Email Parser & Automation', text_ko:'이메일 파싱 & 자동화 시스템 (Python + IMAP + Claude).\n이메일 분류, 중요 정보 추출(AI), 자동 응답 초안, Jira/Notion 연동, 일일 요약 발송.', text_en:'Email parsing & automation system (Python + IMAP + Claude).\nEmail classification, key info extraction (AI), auto reply drafts, Jira/Notion integration, daily digest.' },
    { label_ko:'콜드 이메일 시퀀서', label_en:'Cold Email Sequencer', text_ko:'영업 이메일 시퀀스 자동화 (Node.js + Resend + PostgreSQL).\n멀티스텝 시퀀스, 오픈/클릭 추적, A/B 테스트, 자동 일시정지, 퍼스널라이제이션 변수.', text_en:'Sales email sequence automation (Node.js + Resend + PostgreSQL).\nMulti-step sequences, open/click tracking, A/B testing, auto-pause, personalization variables.' },
  ],
  search: [
    { label_ko:'Elasticsearch 검색 엔진', label_en:'Elasticsearch Search Engine', text_ko:'전문 검색 엔진 서비스 (Node.js + Elasticsearch 8).\n인덱싱 파이프라인, 형태소 분석기(노리), 자동완성, 패싯 필터, 하이라이팅, 관련도 튜닝.', text_en:'Full-text search engine service (Node.js + Elasticsearch 8).\nIndexing pipeline, morphological analyzer (Nori), auto-complete, facet filters, highlighting, relevance tuning.' },
    { label_ko:'Algolia 검색 통합', label_en:'Algolia Search Integration', text_ko:'Algolia 검색 통합 (Next.js + InstantSearch).\n인덱스 동기화 파이프라인, 커스텀 UI 컴포넌트, 검색어 자동완성, 카테고리 필터, 분석.', text_en:'Algolia search integration (Next.js + InstantSearch).\nIndex sync pipeline, custom UI components, query auto-complete, category filters, analytics.' },
    { label_ko:'벡터 의미론적 검색', label_en:'Vector Semantic Search', text_ko:'시맨틱 벡터 검색 서비스 (Python + pgvector + FastAPI).\n문서 임베딩(Voyage/OpenAI), 코사인 유사도, 하이브리드 검색(BM25+벡터), 재랭킹, API.', text_en:'Semantic vector search service (Python + pgvector + FastAPI).\nDocument embedding (Voyage/OpenAI), cosine similarity, hybrid search (BM25+vector), re-ranking, API.' },
    { label_ko:'Typesense 인스턴트 검색', label_en:'Typesense Instant Search', text_ko:'Typesense 초고속 타이포 허용 검색 (Next.js + Typesense).\n셀프호스팅, 인덱스 설계, 동의어, 지리검색, 다중 컬렉션, InstantSearch.js UI 컴포넌트.', text_en:'Typesense ultra-fast typo-tolerant search (Next.js + Typesense).\nSelf-hosted, index design, synonyms, geo search, multi-collection, InstantSearch.js UI components.' },
  ],
  queue: [
    { label_ko:'Bull 작업 큐 시스템', label_en:'Bull Job Queue System', text_ko:'Bull 기반 백그라운드 작업 큐 (Node.js + Redis + BullMQ).\n작업 우선순위, 재시도/backoff, 반복 작업(cron), 병렬 처리, Bull Board 대시보드, 모니터링.', text_en:'Bull background job queue (Node.js + Redis + BullMQ).\nJob priority, retry/backoff, recurring jobs (cron), parallel processing, Bull Board dashboard, monitoring.' },
    { label_ko:'Celery + Redis 비동기', label_en:'Celery + Redis Async', text_ko:'Python Celery 비동기 태스크 시스템 (FastAPI + Celery + Redis).\n태스크 체이닝, 그룹/코드, 재시도, Flower 모니터링, 결과 저장, 배포 설정.', text_en:'Python Celery async task system (FastAPI + Celery + Redis).\nTask chaining, groups/chords, retry, Flower monitoring, result storage, deployment config.' },
    { label_ko:'AWS SQS + Lambda', label_en:'AWS SQS + Lambda', text_ko:'AWS SQS + Lambda 서버리스 메시지 처리.\nFIFO 큐, 메시지 필터링, DLQ, Lambda 트리거, 배치 처리, CDK 인프라, X-Ray 트레이싱.', text_en:'AWS SQS + Lambda serverless message processing.\nFIFO queue, message filtering, DLQ, Lambda triggers, batch processing, CDK infrastructure, X-Ray tracing.' },
    { label_ko:'이벤트 소싱 시스템', label_en:'Event Sourcing System', text_ko:'이벤트 소싱 & CQRS 시스템 (Node.js + EventStoreDB).\n이벤트 스트림, 프로젝션, 스냅샷, 커맨드 핸들러, 읽기 모델 동기화, API 레이어.', text_en:'Event sourcing & CQRS system (Node.js + EventStoreDB).\nEvent streams, projections, snapshots, command handlers, read model sync, API layer.' },
  ],
  payment: [
    { label_ko:'Stripe 결제 통합', label_en:'Stripe Payment Integration', text_ko:'Stripe 완전 결제 통합 (Next.js + Stripe).\n일회성/구독 결제, 웹훅 처리, 환불/크레딧, 세금 자동 계산, 인보이스, Connect(마켓플레이스).', text_en:'Stripe full payment integration (Next.js + Stripe).\nOne-time/subscription payments, webhook handling, refunds/credits, auto tax calculation, invoices, Connect (marketplace).' },
    { label_ko:'토스페이먼츠 연동', label_en:'Toss Payments Integration', text_ko:'토스페이먼츠 결제 연동 (Next.js + 토스 SDK).\n일반/정기결제, 위젯 통합, 웹훅, 취소/환불, 가상계좌, 에스크로, 전자영수증, 테스트 모드.', text_en:'Toss Payments integration (Next.js + Toss SDK).\nOne-time/recurring payments, widget integration, webhooks, cancel/refund, virtual account, escrow, e-receipt, test mode.' },
    { label_ko:'가상화폐 결제 게이트웨이', label_en:'Crypto Payment Gateway', text_ko:'암호화폐 결제 게이트웨이 (Node.js + Web3.js).\nETH/USDC/USDT 수취, 주소 생성, 입금 확인(블록 컨펌), 환율 변환, 정산, 백오피스.', text_en:'Crypto payment gateway (Node.js + Web3.js).\nETH/USDC/USDT receiving, address generation, deposit confirmation (block confirmations), exchange rate conversion, settlement, back-office.' },
    { label_ko:'구독 & 과금 엔진', label_en:'Subscription & Billing Engine', text_ko:'유연한 구독 과금 엔진 (Node.js + Stripe + PostgreSQL).\n플랜/티어 정의, 사용량 기반 과금, 업그레이드/다운그레이드 프레이팅, 청구서, 할인 코드.', text_en:'Flexible subscription billing engine (Node.js + Stripe + PostgreSQL).\nPlan/tier definition, usage-based billing, upgrade/downgrade prorating, invoices, discount codes.' },
  ],
  notification: [
    { label_ko:'푸시 알림 서비스', label_en:'Push Notification Service', text_ko:'멀티채널 푸시 알림 서비스 (Node.js + FCM/APNs + Redis).\n토픽 구독, 개인화 알림, 예약 발송, 전송 통계, 읽음 확인, iOS/Android/웹 동시 지원.', text_en:'Multi-channel push notification service (Node.js + FCM/APNs + Redis).\nTopic subscription, personalized alerts, scheduled delivery, send stats, read receipts, iOS/Android/web support.' },
    { label_ko:'인앱 알림 시스템', label_en:'In-App Notification System', text_ko:'실시간 인앱 알림 시스템 (React + Socket.io + PostgreSQL).\n알림 센터 UI, 읽음/안 읽음, 필터, 알림 유형별 아이콘, 배지 카운트, 무한 스크롤.', text_en:'Real-time in-app notification system (React + Socket.io + PostgreSQL).\nNotification center UI, read/unread, filters, type-specific icons, badge count, infinite scroll.' },
    { label_ko:'이메일/SMS 멀티채널', label_en:'Email/SMS Multi-channel', text_ko:'이메일 + SMS + 카카오 알림톡 멀티채널 발송 (Python + Celery).\n채널 우선순위 폴백, 템플릿 관리, 수신 동의, 발송 이력, 통계, 어드민 UI 포함.', text_en:'Email + SMS + KakaoTalk multi-channel delivery (Python + Celery).\nChannel priority fallback, template management, consent management, send history, stats, admin UI included.' },
    { label_ko:'웹훅 전송 시스템', label_en:'Webhook Delivery System', text_ko:'신뢰성 높은 웹훅 전송 시스템 (Node.js + BullMQ + PostgreSQL).\n서명(HMAC), 재시도(지수 백오프), 실패 알림, 전송 로그, 대시보드, SDK 예제 코드.', text_en:'Reliable webhook delivery system (Node.js + BullMQ + PostgreSQL).\nSignature (HMAC), retry (exponential backoff), failure alerts, delivery logs, dashboard, SDK example code.' },
  ],
  lowcode: [
    { label_ko:'노코드 폼 빌더', label_en:'No-code Form Builder', text_ko:'드래그앤드롭 폼 빌더 (React + React DnD).\n필드 타입(텍스트/선택/파일), 조건부 표시, 유효성 검사, 응답 수집/내보내기, 임베드 코드 생성.', text_en:'Drag-and-drop form builder (React + React DnD).\nField types (text/select/file), conditional display, validation, response collection/export, embed code generation.' },
    { label_ko:'비주얼 워크플로 빌더', label_en:'Visual Workflow Builder', text_ko:'비주얼 워크플로 자동화 빌더 (React + React Flow + FastAPI).\n노드 드래그, 엣지 연결, 조건/루프 노드, 실행 히스토리, JSON 직렬화, 워크플로 실행 엔진.', text_en:'Visual workflow automation builder (React + React Flow + FastAPI).\nNode drag, edge connection, condition/loop nodes, execution history, JSON serialization, workflow execution engine.' },
    { label_ko:'대시보드 빌더', label_en:'Dashboard Builder', text_ko:'드래그앤드롭 대시보드 빌더 (React + GridStack + Recharts).\n위젯 추가/이동/리사이즈, 데이터소스 연결(REST/SQL), 자동 새로고침, 공유/임베드.', text_en:'Drag-and-drop dashboard builder (React + GridStack + Recharts).\nWidget add/move/resize, data source connection (REST/SQL), auto-refresh, share/embed.' },
    { label_ko:'앱 빌더 플랫폼', label_en:'App Builder Platform', text_ko:'내부 툴 앱 빌더 플랫폼 (React + Node.js + PostgreSQL).\n컴포넌트 팔레트, 데이터 바인딩, 액션(API 호출/쿼리), 권한 관리, 버전 관리, 퍼블리시.', text_en:'Internal tool app builder platform (React + Node.js + PostgreSQL).\nComponent palette, data binding, actions (API calls/queries), permission management, versioning, publish.' },
  ],
  os: [
    { label_ko:'Linux 셸 스크립트 모음', label_en:'Linux Shell Script Collection', text_ko:'프로덕션 서버 관리 셸 스크립트 모음 (Bash).\n서버 초기 설정, Nginx/SSL 자동 갱신, DB 백업/복구, 로그 로테이션, 서비스 헬스체크.', text_en:'Production server management shell scripts (Bash).\nServer initial setup, Nginx/SSL auto-renewal, DB backup/restore, log rotation, service health check.' },
    { label_ko:'시스템 모니터링 에이전트', label_en:'System Monitoring Agent', text_ko:'시스템 리소스 모니터링 에이전트 (Go + InfluxDB).\nCPU/메모리/디스크/네트워크 수집, 프로세스 목록, 알림 임계값, 중앙 집계 서버 전송.', text_en:'System resource monitoring agent (Go + InfluxDB).\nCPU/memory/disk/network collection, process list, alert thresholds, central aggregation server push.' },
    { label_ko:'파일 동기화 도구', label_en:'File Sync Tool', text_ko:'P2P 파일 동기화 도구 (Python + asyncio + WebSocket).\n파일 변경 감지(watchdog), 델타 싱크, 충돌 해결, 암호화 전송, CLI + GUI(tkinter).', text_en:'P2P file sync tool (Python + asyncio + WebSocket).\nFile change detection (watchdog), delta sync, conflict resolution, encrypted transfer, CLI + GUI (tkinter).' },
    { label_ko:'프로세스 슈퍼바이저', label_en:'Process Supervisor', text_ko:'프로세스 관리 & 슈퍼바이저 (Go).\n프로세스 시작/중지/재시작, 자동 재시작, 로그 집계, 설정 파일(TOML), REST API, 웹 UI.', text_en:'Process manager & supervisor (Go).\nProcess start/stop/restart, auto-restart, log aggregation, config file (TOML), REST API, web UI.' },
  ],
  doc: [
    { label_ko:'기술 문서 사이트 (VitePress)', label_en:'Tech Docs Site (VitePress)', text_ko:'VitePress 기술 문서 사이트.\n마크다운 기반, 버전 관리, 검색(Algolia), i18n, 커스텀 테마, API 레퍼런스 자동 생성, GitHub Pages.', text_en:'VitePress technical docs site.\nMarkdown-based, versioning, search (Algolia), i18n, custom theme, API reference auto-generation, GitHub Pages.' },
    { label_ko:'Swagger + Redoc API 문서', label_en:'Swagger + Redoc API Docs', text_ko:'OpenAPI 기반 API 문서 포털 (Redoc + Swagger UI + Next.js).\n다중 API 버전, 인터랙티브 "Try it", 커스텀 테마, 인증 설정, 코드 스니펫 생성.', text_en:'OpenAPI API docs portal (Redoc + Swagger UI + Next.js).\nMulti API versions, interactive "Try it", custom theme, auth setup, code snippet generation.' },
    { label_ko:'사내 위키 시스템', label_en:'Internal Wiki System', text_ko:'사내 지식 관리 위키 (Next.js + TipTap + PostgreSQL).\n리치 텍스트 편집, 버전 히스토리, 권한 관리, 전체 검색, 태그, 댓글, Slack 알림 연동.', text_en:'Internal knowledge management wiki (Next.js + TipTap + PostgreSQL).\nRich text editing, version history, permission management, full-text search, tags, comments, Slack alert integration.' },
    { label_ko:'인터랙티브 API 탐색기', label_en:'Interactive API Explorer', text_ko:'인터랙티브 API 탐색기 (React + OpenAPI + Monaco Editor).\n실시간 요청 테스트, 응답 포맷팅, 인증 헤더 관리, 히스토리, 컬렉션 저장, 팀 공유.', text_en:'Interactive API explorer (React + OpenAPI + Monaco Editor).\nReal-time request testing, response formatting, auth header management, history, collection saving, team sharing.' },
  ],
  interview: [
    { label_ko:'AI 모의 면접 시스템', label_en:'AI Mock Interview System', text_ko:'AI 기술 면접 시뮬레이터 (Next.js + Claude API + TTS).\n직군별 질문 생성, 답변 녹음/분석, 피드백 리포트, 면접 히스토리, 약점 분석 대시보드.', text_en:'AI tech interview simulator (Next.js + Claude API + TTS).\nRole-specific question generation, answer recording/analysis, feedback report, interview history, weakness analysis dashboard.' },
    { label_ko:'이력서 분석 서비스', label_en:'Resume Analysis Service', text_ko:'AI 이력서 분석 & 개선 서비스 (Python + Claude + PDF 파싱).\n이력서 업로드(PDF/DOCX), 강점/약점 분석, 키워드 최적화, ATS 점수, 개선 제안, 다운로드.', text_en:'AI resume analysis & improvement service (Python + Claude + PDF parsing).\nResume upload (PDF/DOCX), strength/weakness analysis, keyword optimization, ATS score, improvement suggestions, download.' },
    { label_ko:'코딩 면접 플랫폼', label_en:'Coding Interview Platform', text_ko:'화상 코딩 면접 플랫폼 (React + Monaco + WebRTC).\n공유 코드 에디터, 실시간 실행(Piston API), 화상통화, 메모, 녹화, 채점 루브릭 작성.', text_en:'Video coding interview platform (React + Monaco + WebRTC).\nShared code editor, real-time execution (Piston API), video call, notes, recording, grading rubric.' },
    { label_ko:'채용 관리 ATS', label_en:'Hiring Management ATS', text_ko:'지원자 추적 시스템 ATS (Next.js + PostgreSQL).\n채용 공고 게시, 지원서 수집, 파이프라인 칸반, 인터뷰 일정, 팀 평가, 이메일 자동화.', text_en:'Applicant tracking system ATS (Next.js + PostgreSQL).\nJob posting, application collection, pipeline kanban, interview scheduling, team evaluation, email automation.' },
  ],
};

// 카테고리별 템플릿 (실행마다 셔플됨)
const HOME_TEMPLATES_RAW = [
  // ── 웹/풀스택 ──
  { key:'webapp',    icon:'🌐', text_ko:'Next.js + FastAPI 기반 웹앱.\n사용자 인증(JWT), CRUD API, 실시간 알림(WebSocket) 기능 필요.', text_en:'Next.js + FastAPI full-stack web app.\nUser auth (JWT), CRUD API, real-time notifications (WebSocket) required.' },
  { key:'landing',   icon:'🎯', text_ko:'제품 랜딩 페이지 (Astro + TailwindCSS).\n히어로 섹션, 가격표, FAQ, 뉴스레터 구독, 빠른 로딩 필요.', text_en:'Product landing page (Astro + TailwindCSS).\nHero section, pricing table, FAQ, newsletter signup, fast loading required.' },
  { key:'dashboard', icon:'📊', text_ko:'관리자 대시보드 (React + Recharts).\n실시간 차트, 사용자 통계, 데이터 필터링/내보내기, 권한 관리 필요.', text_en:'Admin dashboard (React + Recharts).\nReal-time charts, user stats, data filtering/export, RBAC required.' },
  { key:'ecommerce', icon:'🛒', text_ko:'이커머스 플랫폼 (Next.js + Stripe).\n상품 목록/상세, 장바구니, 결제, 주문 관리, 재고 추적 필요.', text_en:'E-commerce platform (Next.js + Stripe).\nProduct listing/detail, cart, checkout, order management, inventory tracking required.' },
  { key:'forum',     icon:'💬', text_ko:'개발자 커뮤니티 포럼 (Next.js + PostgreSQL).\n게시글/댓글, 마크다운 에디터, 태그, 검색, 좋아요, 포인트 시스템 필요.', text_en:'Developer community forum (Next.js + PostgreSQL).\nPosts/comments, markdown editor, tags, search, likes, point system required.' },
  { key:'portfolio', icon:'🎨', text_ko:'개발자 포트폴리오 사이트 (Next.js + Framer Motion).\n프로젝트 갤러리, 스킬 섹션, 블로그, 다크모드, SEO 최적화 필요.', text_en:'Developer portfolio site (Next.js + Framer Motion).\nProject gallery, skills section, blog, dark mode, SEO optimization required.' },
  // ── 백엔드/API ──
  { key:'api',       icon:'⚙️', text_ko:'REST API 서버 (Python FastAPI).\n인증(JWT/OAuth2), rate limiting, PostgreSQL 연동, OpenAPI 문서 자동 생성 필요.', text_en:'REST API server (Python FastAPI).\nAuth (JWT/OAuth2), rate limiting, PostgreSQL, auto-generated OpenAPI docs required.' },
  { key:'graphql',   icon:'🔗', text_ko:'GraphQL API 서버 (Node.js + Apollo Server).\n스키마 설계, 리졸버, 인증 미들웨어, 데이터로더(N+1 방지), 구독 필요.', text_en:'GraphQL API server (Node.js + Apollo Server).\nSchema design, resolvers, auth middleware, DataLoader (N+1 prevention), subscriptions required.' },
  { key:'microservice', icon:'🧩', text_ko:'마이크로서비스 아키텍처 (Python + Docker).\n서비스 분리, API 게이트웨이, 메시지 큐(RabbitMQ), 서비스 디스커버리 필요.', text_en:'Microservice architecture (Python + Docker).\nService separation, API gateway, message queue (RabbitMQ), service discovery required.' },
  { key:'auth',      icon:'🔐', text_ko:'인증/인가 서비스 (Node.js).\nJWT + refresh token, OAuth2 소셜 로그인(Google/GitHub), RBAC, 이메일 인증 필요.', text_en:'Auth service (Node.js).\nJWT + refresh token, OAuth2 social login (Google/GitHub), RBAC, email verification required.' },
  // ── 모바일 ──
  { key:'mobile',    icon:'📱', text_ko:'React Native 모바일 앱.\n소셜 로그인, 푸시 알림, 오프라인 지원, 앱스토어 배포 설정 필요.', text_en:'React Native mobile app.\nSocial login, push notifications, offline support, app store deployment required.' },
  { key:'pwa',       icon:'📲', text_ko:'Progressive Web App (Next.js).\n오프라인 지원(Service Worker), 설치 가능, 푸시 알림, 앱 아이콘, 빠른 로딩 필요.', text_en:'Progressive Web App (Next.js).\nOffline support (Service Worker), installable, push notifications, app icon, fast loading required.' },
  // ── 데스크탑/CLI/툴 ──
  { key:'cli',       icon:'⌨️', text_ko:'CLI 도구 (Python).\n인자 파싱(Click), 설정 파일, 플러그인 시스템, 자동완성, PyPI 패키지 배포 포함.', text_en:'CLI tool (Python).\nArg parsing (Click), config file, plugin system, auto-completion, PyPI deployment included.' },
  { key:'desktop',   icon:'🖥️', text_ko:'데스크탑 앱 (Electron + React).\n네이티브 메뉴, 파일 시스템 접근, 자동 업데이터, 트레이 아이콘, 크로스플랫폼 빌드 필요.', text_en:'Desktop app (Electron + React).\nNative menu, file system access, auto-updater, tray icon, cross-platform build required.' },
  { key:'vscode',    icon:'🧩', text_ko:'VSCode 확장 프로그램 (TypeScript).\n커맨드 팔레트, 사이드바 웹뷰, 언어 서버 연동, 설정 스키마, 마켓플레이스 배포 필요.', text_en:'VSCode extension (TypeScript).\nCommand palette, sidebar webview, language server, settings schema, marketplace deployment required.' },
  { key:'chrome',    icon:'🔌', text_ko:'Chrome 확장 프로그램 (Manifest V3).\n현재 페이지 분석, 팝업 UI, 백그라운드 서비스 워커, 콘텐츠 스크립트, 설정 저장 필요.', text_en:'Chrome extension (Manifest V3).\nPage analysis, popup UI, background service worker, content script, settings storage required.' },
  // ── AI/ML ──
  { key:'chatbot',   icon:'🤖', text_ko:'AI 챗봇 서비스 (Python + Claude API).\n멀티턴 대화, 시스템 프롬프트 커스텀, 스트리밍 응답, 대화 히스토리 저장, 웹 UI 필요.', text_en:'AI chatbot service (Python + Claude API).\nMulti-turn conversation, custom system prompt, streaming response, chat history, web UI required.' },
  { key:'ml',        icon:'🧠', text_ko:'ML 학습 파이프라인 (Python + PyTorch).\n데이터 전처리, 모델 훈련, 실험 추적(MLflow), 평가, 모델 서빙(FastAPI) 포함.', text_en:'ML training pipeline (Python + PyTorch).\nData preprocessing, model training, experiment tracking (MLflow), evaluation, model serving (FastAPI) included.' },
  { key:'rag',       icon:'📚', text_ko:'RAG(검색 증강 생성) 시스템 (Python + LangChain).\n문서 임베딩, 벡터DB(Chroma), 하이브리드 검색, Claude 연동, 웹 UI 필요.', text_en:'RAG (Retrieval Augmented Generation) system (Python + LangChain).\nDocument embedding, vector DB (Chroma), hybrid search, Claude integration, web UI required.' },
  { key:'agent',     icon:'🕵️', text_ko:'자율 AI 에이전트 (Python + Claude API).\n도구 사용(웹검색/코드실행/파일), 계획 수립, 멀티에이전트 협업, 태스크 자동화 필요.', text_en:'Autonomous AI agent (Python + Claude API).\nTool use (web search/code execution/file), planning, multi-agent collaboration, task automation required.' },
  // ── 데이터/자동화 ──
  { key:'scraper',   icon:'🕷️', text_ko:'웹 크롤러 / 데이터 수집 파이프라인.\nPlaywright 기반 동적 페이지 크롤링, 스케줄러(APScheduler), DB 저장, 중복 제거 필요.', text_en:'Web crawler / data collection pipeline.\nPlaywright dynamic page crawling, scheduler (APScheduler), DB storage, deduplication required.' },
  { key:'etl',       icon:'🔄', text_ko:'데이터 ETL 파이프라인 (Python + Airflow).\n다중 소스 수집(API/DB/파일), 변환/정제, 적재, 스케줄링, 모니터링 대시보드 필요.', text_en:'Data ETL pipeline (Python + Airflow).\nMulti-source ingestion (API/DB/file), transform/clean, load, scheduling, monitoring dashboard required.' },
  { key:'analytics', icon:'📈', text_ko:'데이터 분석 & 시각화 플랫폼 (Python + Streamlit).\nPandas 데이터 처리, 인터랙티브 차트, 필터링, 리포트 생성, 배포 필요.', text_en:'Data analysis & visualization platform (Python + Streamlit).\nPandas data processing, interactive charts, filtering, report generation, deployment required.' },
  { key:'automation',icon:'⚡', text_ko:'업무 자동화 봇 (Python + Selenium/Playwright).\n반복 웹 작업 자동화, 이메일/슬랙 알림, 스케줄 실행, 오류 재시도 로직 필요.', text_en:'Task automation bot (Python + Selenium/Playwright).\nRepetitive web task automation, email/Slack alerts, scheduled execution, error retry logic required.' },
  // ── DevOps/인프라 ──
  { key:'cicd',      icon:'🚀', text_ko:'CI/CD 파이프라인 (GitHub Actions + Docker).\n자동 테스트, 빌드, 도커 이미지 빌드/푸시, 스테이징/프로덕션 배포, 슬랙 알림 필요.', text_en:'CI/CD pipeline (GitHub Actions + Docker).\nAuto testing, build, Docker image build/push, staging/production deploy, Slack notifications required.' },
  { key:'monitoring',icon:'🔍', text_ko:'서버 모니터링 & 알림 시스템 (Python + Prometheus).\n메트릭 수집, Grafana 대시보드, 임계값 알림(이메일/슬랙), 로그 분석 필요.', text_en:'Server monitoring & alerting system (Python + Prometheus).\nMetrics collection, Grafana dashboard, threshold alerts (email/Slack), log analysis required.' },
  // ── 게임/엔터테인먼트 ──
  { key:'game',      icon:'🎮', text_ko:'Unity 기반 2D 플랫포머 게임.\n플레이어 이동/점프, 적 AI, 스테이지 클리어, 사운드 시스템, Google Play 배포 필요.', text_en:'Unity 2D platformer game.\nPlayer movement/jump, enemy AI, stage clear, sound system, Google Play deployment required.' },
  { key:'webgame',   icon:'🕹️', text_ko:'브라우저 게임 (TypeScript + Phaser 3).\n게임 루프, 스프라이트/애니메이션, 물리 엔진, 점수 저장, 모바일 터치 지원 필요.', text_en:'Browser game (TypeScript + Phaser 3).\nGame loop, sprites/animation, physics engine, score saving, mobile touch support required.' },
  // ── 커뮤니케이션/협업 ──
  { key:'discord',   icon:'🤖', text_ko:'Discord 봇 (discord.py).\n슬래시 커맨드, 역할 자동 부여, 공지 예약, 로그 채널, GPT/Claude 연동 기능 필요.', text_en:'Discord bot (discord.py).\nSlash commands, auto role assignment, scheduled announcements, log channel, GPT/Claude integration required.' },
  { key:'slack',     icon:'💼', text_ko:'Slack 앱 (Python + Bolt).\n슬래시 커맨드, 모달 UI, 블록 킷, 이벤트 핸들링, Workflow Step, 알림 봇 기능 필요.', text_en:'Slack app (Python + Bolt).\nSlash commands, modal UI, Block Kit, event handling, Workflow Step, notification bot required.' },
  { key:'telegram',  icon:'✈️', text_ko:'Telegram 봇 (Python + python-telegram-bot).\n커맨드 핸들러, 인라인 키보드, 결제, 그룹 관리, AI 연동, 웹훅 배포 필요.', text_en:'Telegram bot (Python + python-telegram-bot).\nCommand handlers, inline keyboard, payment, group management, AI integration, webhook deployment required.' },
  // ── 기타 실용 ──
  { key:'saas',      icon:'💳', text_ko:'SaaS 구독 서비스 (Next.js + Stripe).\n플랜별 기능 제한, 결제/구독 관리, 팀 대시보드, 이메일 온보딩, Stripe Billing 필요.', text_en:'SaaS subscription service (Next.js + Stripe).\nPlan-based feature gating, billing/subscription management, team dashboard, email onboarding, Stripe Billing required.' },
  { key:'blog',      icon:'✍️', text_ko:'개인 블로그 사이트 (Next.js + MDX).\n마크다운 포스트, 태그/카테고리, 댓글(giscus), SEO/OG 메타태그, RSS 피드 필요.', text_en:'Personal blog site (Next.js + MDX).\nMarkdown posts, tags/categories, comments (giscus), SEO/OG meta tags, RSS feed required.' },
  { key:'coding',    icon:'🏆', text_ko:'코딩 테스트 준비 플랫폼.\n문제 풀이 환경(Python/JS), 온라인 채점 서버, 시간·메모리 측정, 풀이 히스토리 저장 필요.', text_en:'Coding test prep platform.\nCode environment (Python/JS), online judge server, time/memory measurement, solution history required.' },
  { key:'openapi',     icon:'📝', text_ko:'OpenAPI 스펙 기반 SDK 자동 생성 + 문서화 도구.\n스키마 파싱, 타입스크립트 타입 생성, 인터랙티브 문서 사이트, CLI 도구 필요.', text_en:'OpenAPI spec-based SDK auto-generation + documentation tool.\nSchema parsing, TypeScript type generation, interactive docs site, CLI tool required.' },
  // ── 실시간/통신 ──
  { key:'realtime',    icon:'⚡', text_ko:'실시간 채팅/협업 서비스 (Node.js + Socket.io + Redis).\n멀티룸 채팅, 타이핑 인디케이터, 읽음 확인, 온라인 목록, 수평 확장 필요.', text_en:'Real-time chat/collaboration service (Node.js + Socket.io + Redis).\nMulti-room chat, typing indicator, read receipts, online list, horizontal scaling required.' },
  // ── 개발 도구 ──
  { key:'devtools',    icon:'🔧', text_ko:'개발 생산성 도구 (Node.js + TypeScript).\nAST 분석, 코드 변환, CLI 스캐폴딩, GitHub 연동, npm 패키지 배포 필요.', text_en:'Developer productivity tool (Node.js + TypeScript).\nAST analysis, code transformation, CLI scaffolding, GitHub integration, npm package deployment required.' },
  // ── 인프라 ──
  { key:'infra',       icon:'☁️', text_ko:'클라우드 인프라 IaC (Terraform + AWS/GCP).\nVPC, 컨테이너, DB, CDN, IAM, 환경별 분리, 자동 프로비저닝 필요.', text_en:'Cloud infrastructure IaC (Terraform + AWS/GCP).\nVPC, containers, DB, CDN, IAM, environment separation, auto-provisioning required.' },
  // ── 보안 ──
  { key:'security',    icon:'🛡️', text_ko:'보안 감사 & 취약점 스캐닝 시스템 (Python).\nOWASP 체크, CVE 스캔, 컴플라이언스 대시보드, 자동 리포트 필요.', text_en:'Security audit & vulnerability scanning system (Python).\nOWASP checks, CVE scanning, compliance dashboard, auto-report required.' },
  // ── 테스트 ──
  { key:'testing',     icon:'🧪', text_ko:'E2E 테스트 자동화 프레임워크 (Playwright + TypeScript).\nPOM 패턴, 시각적 회귀, API 모킹, CI 통합, HTML 리포트 생성 필요.', text_en:'E2E test automation framework (Playwright + TypeScript).\nPOM pattern, visual regression, API mocking, CI integration, HTML report generation required.' },
  // ── 핀테크 ──
  { key:'finance',     icon:'💰', text_ko:'금융 & 가계부 서비스 (Next.js + PostgreSQL).\n수입/지출 추적, 예산 관리, 차트, 암호화폐 연동, CSV 내보내기 필요.', text_en:'Finance & budgeting service (Next.js + PostgreSQL).\nIncome/expense tracking, budget management, charts, crypto integration, CSV export required.' },
  // ── 헬스케어 ──
  { key:'health',      icon:'❤️', text_ko:'헬스 & 피트니스 트래커 앱 (React Native + Expo).\n운동 로그, 영양소 분석, 목표 설정, 알림, 차트, App Store 배포 필요.', text_en:'Health & fitness tracker app (React Native + Expo).\nWorkout log, nutrition analysis, goal setting, notifications, charts, App Store deployment required.' },
  // ── 교육 ──
  { key:'edu',         icon:'🎓', text_ko:'온라인 학습 플랫폼 (Next.js + Prisma).\n코스/레슨, 동영상, 퀴즈, 진도 추적, 수료증, 결제 연동 필요.', text_en:'Online learning platform (Next.js + Prisma).\nCourses/lessons, video, quizzes, progress tracking, certificates, payment integration required.' },
  // ── 지도/위치 ──
  { key:'map',         icon:'🗺️', text_ko:'인터랙티브 지도 서비스 (React + Mapbox/Leaflet).\n커스텀 마커, 경로 안내, 장소 검색, 실시간 추적, GeoJSON 렌더 필요.', text_en:'Interactive map service (React + Mapbox/Leaflet).\nCustom markers, route directions, place search, real-time tracking, GeoJSON rendering required.' },
  // ── 미디어 ──
  { key:'media',       icon:'🎬', text_ko:'미디어 편집 & 스트리밍 플랫폼 (React + FFmpeg).\n동영상/이미지 편집, 팟캐스트, AI 생성, 업로드/스토리지, 공유 필요.', text_en:'Media editing & streaming platform (React + FFmpeg).\nVideo/image editing, podcast, AI generation, upload/storage, sharing required.' },
  // ── IoT ──
  { key:'iot',         icon:'📡', text_ko:'IoT 모니터링 & 자동화 시스템 (Python + MQTT + InfluxDB).\n센서 수집, 실시간 대시보드, 자동화 룰, 알림, 에너지 분석 필요.', text_en:'IoT monitoring & automation system (Python + MQTT + InfluxDB).\nSensor collection, real-time dashboard, automation rules, alerts, energy analysis required.' },
  // ── 블록체인 ──
  { key:'blockchain',  icon:'⛓️', text_ko:'이더리움 스마트 컨트랙트 + DApp (Solidity + Hardhat + React).\nERC-20/721, MetaMask 연동, 테스트넷 배포, 보안 감사 필요.', text_en:'Ethereum smart contract + DApp (Solidity + Hardhat + React).\nERC-20/721, MetaMask integration, testnet deployment, security audit required.' },
  // ── CMS ──
  { key:'cms',         icon:'📰', text_ko:'헤드리스 CMS 기반 웹사이트 (Next.js + Sanity/Strapi).\n콘텐츠 관리, GROQ/GraphQL, ISR, 이미지 최적화, 미리보기 필요.', text_en:'Headless CMS website (Next.js + Sanity/Strapi).\nContent management, GROQ/GraphQL, ISR, image optimization, preview required.' },
  // ── 이메일 ──
  { key:'email',       icon:'📧', text_ko:'이메일 뉴스레터 & 트랜잭션 발송 플랫폼 (Node.js + Resend).\n구독 관리, 템플릿, 발송 큐, 오픈율 추적, 자동화 시퀀스 필요.', text_en:'Email newsletter & transactional platform (Node.js + Resend).\nSubscription management, templates, send queue, open rate tracking, automation sequences required.' },
  // ── 검색 ──
  { key:'search',      icon:'🔍', text_ko:'전문 검색 서비스 (Node.js + Elasticsearch/Algolia).\n인덱싱, 자동완성, 패싯 필터, 시맨틱 검색, 관련도 튜닝 필요.', text_en:'Full-text search service (Node.js + Elasticsearch/Algolia).\nIndexing, auto-complete, facet filters, semantic search, relevance tuning required.' },
  // ── 큐/메시지 ──
  { key:'queue',       icon:'📬', text_ko:'백그라운드 작업 큐 시스템 (Node.js + BullMQ + Redis).\n우선순위, 재시도, 반복 작업, 모니터링 대시보드, 수평 확장 필요.', text_en:'Background job queue system (Node.js + BullMQ + Redis).\nPriority, retry, recurring jobs, monitoring dashboard, horizontal scaling required.' },
  // ── 결제 ──
  { key:'payment',     icon:'💳', text_ko:'멀티 결제 수단 통합 (Next.js + Stripe/토스페이먼츠).\n일회성/구독, 웹훅, 환불, 세금 계산, 인보이스, 마켓플레이스 지원.', text_en:'Multi-payment integration (Next.js + Stripe).\nOne-time/subscription, webhooks, refunds, tax calculation, invoices, marketplace support.' },
  // ── 알림 ──
  { key:'notification',icon:'🔔', text_ko:'멀티채널 알림 서비스 (Node.js + FCM + Redis).\n푸시/인앱/이메일/SMS, 예약 발송, 읽음 확인, 통계, 웹훅 전송.', text_en:'Multi-channel notification service (Node.js + FCM + Redis).\nPush/in-app/email/SMS, scheduled delivery, read receipts, stats, webhook delivery.' },
  // ── 로우코드 ──
  { key:'lowcode',     icon:'🧱', text_ko:'드래그앤드롭 빌더 플랫폼 (React + React DnD).\n폼/워크플로/대시보드 빌더, 데이터소스 연결, 권한 관리, 임베드 지원.', text_en:'Drag-and-drop builder platform (React + React DnD).\nForm/workflow/dashboard builder, data source connection, permissions, embed support.' },
  // ── OS/시스템 ──
  { key:'os',          icon:'🖥', text_ko:'서버 & 시스템 관리 도구 (Go/Python).\n모니터링 에이전트, 파일 동기화, 프로세스 슈퍼바이저, 셸 스크립트 자동화.', text_en:'Server & system management tools (Go/Python).\nMonitoring agent, file sync, process supervisor, shell script automation.' },
  // ── 문서 ──
  { key:'doc',         icon:'📖', text_ko:'기술 문서 & 위키 플랫폼 (VitePress/Next.js).\nAPI 레퍼런스, 사내 위키, 인터랙티브 탐색기, 검색, 버전 관리 필요.', text_en:'Technical docs & wiki platform (VitePress/Next.js).\nAPI reference, internal wiki, interactive explorer, search, version management required.' },
  // ── 채용/면접 ──
  { key:'interview',   icon:'🎤', text_ko:'AI 기술 면접 & 채용 관리 플랫폼 (Next.js + Claude API).\n모의 면접, 이력서 분석, 코딩 테스트, ATS 파이프라인 필요.', text_en:'AI tech interview & hiring management platform (Next.js + Claude API).\nMock interviews, resume analysis, coding tests, ATS pipeline required.' },
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
// HOME_TEMPLATES[key] → {text_ko, text_en} (home.js에서 현재 언어에 맞게 사용)
HOME_BUTTONS_ORDER.forEach(t=>{ HOME_TEMPLATES[t.key]={text_ko:t.text_ko, text_en:t.text_en}; });

// HOME_VARIANTS 키가 HOME_TEMPLATES에 모두 존재하는지 로드 시점 검증 (개발 디버깅용)
(function _validateHomeVariantKeys(){
  const missing = Object.keys(HOME_VARIANTS).filter(k => !HOME_TEMPLATES[k]);
  if(missing.length) console.warn('[CCPilot] HOME_VARIANTS 키가 HOME_TEMPLATES_RAW에 없음:', missing);
})();
