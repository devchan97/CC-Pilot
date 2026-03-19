# 쇼핑몰 프로젝트 PRD

## 개요
Next.js + FastAPI + PostgreSQL 기반 e-commerce 플랫폼.
소규모 팀(3명)이 2주 안에 MVP를 출시해야 한다.

## 주요 기능
- 사용자 인증/인가 (JWT, OAuth Google)
- 상품 목록 및 검색 (Elasticsearch)
- 장바구니 및 결제 (Stripe)
- 관리자 대시보드

## 기술 스택
- **Frontend**: Next.js 14, Tailwind CSS, Zustand
- **Backend**: FastAPI, SQLAlchemy, Alembic
- **DB**: PostgreSQL 15, Redis (캐시)
- **Infra**: Docker Compose, GitHub Actions CI/CD

## 디렉토리 구조 (예상)
```
project/
├── frontend/   # Next.js 앱
├── backend/    # FastAPI 앱
├── db/         # 마이그레이션, 시드 데이터
└── infra/      # Docker, CI/CD 설정
```

## 우선순위
1. 사용자 인증 API + 프론트 로그인 페이지
2. 상품 CRUD API + 목록 페이지
3. 결제 연동
4. 관리자 대시보드
