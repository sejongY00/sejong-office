# sejong-office

임시 세션 기반 문서 편집 웹앱입니다.

- **오피스 / PDF** → [ONLYOFFICE Document Server](https://www.onlyoffice.com/)
- **HWP / HWPX** → [rhwp](https://github.com/edwardkim/rhwp) (`@rhwp/editor`)

서버에 문서를 **영구 저장하지 않습니다**. 오피스·PDF는 세션 동안만 tmpfs에 두고, 브라우저 종료·TTL로 삭제합니다. HWP/HWPX는 기본적으로 브라우저 메모리에서만 다룹니다. 편집 결과는 **다운로드**로만 가져가세요.

## 스택

- Vue 3 + Vite + TypeScript
- Express + TypeScript
- Docker Compose

## 빠른 시작 (Docker)

```bash
cp .env.example .env
# JWT_SECRET 을 긴 임의 문자열로 바꾸세요

docker compose up --build
```

- 앱: http://localhost:3000
- Document Server: http://localhost:8080

첫 Document Server 기동은 수 분 걸릴 수 있습니다.

## 로컬 개발

```bash
npm install
cp .env.example .env

# 터미널 1 — API (포트 3000)
npm run dev:backend

# 터미널 2 — Vite (포트 5173, /api 프록시)
npm run dev:frontend
```

OnlyOffice Document Server는 Docker로만 띄워도 됩니다.

```bash
docker compose up onlyoffice
```

## 소스 저장소 링크

프론트 [`packages/frontend/src/config/app.ts`](packages/frontend/src/config/app.ts) 의 `APP_GIT_URL` 에 Git URL을 넣으면 푸터에 **소스 코드** 링크가 표시됩니다.

## 라이선스 고지

앱 내 [/licenses](http://localhost:3000/licenses) 페이지에서 OnlyOffice(AGPL), rhwp(MIT), 주요 OSS 고지를 볼 수 있습니다.

- 본 앱: MIT
- ONLYOFFICE Document Server Community: AGPL-3.0 (배포 시 의무 확인)
- rhwp: MIT — Hancom 상표와 무관한 독립 프로젝트

## 포맷 안내

| 확장자 | 엔진 | 저장 |
|--------|------|------|
| hwp, hwpx | rhwp | 원본 확장자로 export |
| pdf, docx, xlsx, pptx 등 | OnlyOffice | 원본 확장자 유지 시도 (`assemblyFormatAsOrigin`) |

rhwp는 v0.7.x 기준이며, 복잡한 공공문서에서 한컴과 조판이 다를 수 있습니다.
