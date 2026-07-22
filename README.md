# sejong-office

임시 세션 기반 문서·도면·스캔 웹앱입니다.

- **오피스 / PDF** → [Euro-Office Document Server](https://github.com/Euro-Office/DocumentServer)
- **HWP / HWPX** → [rhwp](https://github.com/edwardkim/rhwp) (`@rhwp/editor`)
- **다이어그램** → Excalidraw · Mermaid · draw.io (브라우저)
- **CAD** → [MLightCAD](https://github.com/mlightcad/cad-viewer) (DXF/DWG, LibreDWG)
- **3D** → [Online 3D Viewer](https://github.com/kovacsv/Online3DViewer) (glTF, OBJ, STEP, IFC, STL, 3DM 등)
- **문서 스캐너** → jscanify + OpenCV.js · [ppu-paddle-ocr](https://github.com/PT-Perkasa-Pilar-Utama/ppu-paddle-ocr) (PP-OCRv5 한국어) · PDF.js

서버에 문서를 **영구 저장하지 않습니다**. 오피스·PDF는 세션 동안만 tmpfs에 두고, 브라우저 종료·TTL로 삭제합니다. HWP/HWPX·CAD·3D·스캐너는 기본적으로 브라우저 메모리에서만 다룹니다. 결과는 **다운로드**로만 가져가세요.

## 스택

- Vue 3 + Vite + TypeScript (프론트)
- Express + TypeScript (API·정적 서빙)
- Docker Compose (앱 + Document Server)
- 뷰어·OCR·PDF.js worker 등은 `/viewer-assets/`에 **자체 호스팅** (CDN 런타임 fetch 없음)

## 빠른 시작 (Docker)

```bash
cp .env.example .env
# JWT_SECRET 을 긴 임의 문자열로 바꾸세요

docker compose up --build
```

- 앱: http://localhost:3000
- Document Server: http://localhost:8080

첫 Document Server 기동은 수 분 걸릴 수 있습니다. 프론트 빌드 시 Paddle OCR 모델·ORT WASM을 내려받으므로 네트워크와 디스크 여유가 필요합니다.

## 로컬 개발

```bash
npm install
cp .env.example .env

# 터미널 1 — API (포트 3000)
npm run dev:backend

# 터미널 2 — Vite (포트 5173, /api 프록시)
# predev 가 viewer-assets(CAD·3D·스캐너·OCR 모델)를 복사합니다
npm run dev:frontend
```

Euro-Office Document Server는 Docker로만 띄워도 됩니다.

```bash
docker compose up documentserver
```

## 문서 스캐너 (`/tools/scanner`)

브라우저에서만 동작합니다.

- **입력**: PNG/JPEG/WebP 등 이미지, 카메라, **다페이지 PDF**(PDF.js로 페이지 래스터화)
- **보정**: 문서 코너 검출·드래그 수정·원근 보정 (jscanify / OpenCV.js)
- **OCR**: PP-OCRv5 Korean (한글·영문), ONNX Runtime Web (WebGPU 우선)
- **목록**: 하단 드롭으로 추가, 드래그로 **순서 변경**
- **저장**: 목록 순서대로 검색 가능 PDF(투명 텍스트 레이어), 또는 PNG로 저장

## 소스 저장소 링크

프론트 [`packages/frontend/src/config/app.ts`](packages/frontend/src/config/app.ts) 의 `APP_GIT_URL` 에 Git URL을 넣으면 푸터에 **소스 코드** 링크가 표시됩니다.

## 라이선스 고지

앱 내 [/licenses](http://localhost:3000/licenses) 에서 상세 고지를 볼 수 있습니다.

- **본 앱: GPL-3.0-only** (LibreDWG / MLightCAD DWG 경로 포함)
- Euro-Office Document Server: AGPL-3.0 (배포 시 의무 확인)
- rhwp: MIT — Hancom 상표와 무관한 독립 프로젝트
- Online 3D Viewer · ppu-paddle-ocr · pdf-lib 등: 각 패키지 라이선스(MIT/Apache-2.0 등)
- PDF.js: Apache-2.0 · PaddleOCR 모델: Apache-2.0

## 포맷 안내

| 확장자 | 엔진 | 비고 |
|--------|------|------|
| hwp, hwpx | rhwp | 원본 확장자로 export |
| pdf, docx, xlsx, pptx 등 | Euro-Office | 세션 tmpfs · `forcesave` / ConvertService |
| dxf, dwg | MLightCAD | 클라이언트 뷰어 · 한글 폴백 글꼴(Noto Sans KR) |
| glTF, OBJ, STEP, IFC, STL, 3DM 등 | Online 3D Viewer | `/viewer-assets/o3dv/` 자체 호스팅 |
| png, jpg, webp, … / pdf(스캐너) | 문서 스캐너 | OCR PDF·PNG 다운로드 |

홈에서 PDF를 열면 Document Server 편집으로 가고, 스캐너에서 PDF를 열면 **페이지 이미지로 변환 후 OCR·재저장**합니다.

rhwp는 v0.7.x 기준이며, 복잡한 공공문서에서 한컴과 조판이 다를 수 있습니다.
