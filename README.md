# sejong-office

서버 없이 브라우저에서만 동작하는 문서·도면·스캔 웹앱입니다. GitHub Pages에 정적 사이트로 배포합니다.

- **오피스 / PDF** → [ranuts/document](https://github.com/ranuts/document) (ONLYOFFICE 편집기 + x2t WebAssembly) — iframe 임베드. 빌드·배포는 [sejongY00/office-editor](https://github.com/sejongY00/office-editor)
- **HWP / HWPX** → [rhwp](https://github.com/edwardkim/rhwp) (`@rhwp/editor`)
- **다이어그램** → Excalidraw · Mermaid · draw.io (브라우저)
- **CAD** → [MLightCAD](https://github.com/mlightcad/cad-viewer) (DXF/DWG, LibreDWG)
- **3D** → [Online 3D Viewer](https://github.com/kovacsv/Online3DViewer) (glTF, OBJ, STEP, IFC, STL, 3DM 등)
- **문서 스캐너** → jscanify + OpenCV.js · [ppu-paddle-ocr](https://github.com/PT-Perkasa-Pilar-Utama/ppu-paddle-ocr) (PP-OCRv5 한국어) · PDF.js

파일은 **어디에도 업로드되지 않습니다**. 모든 형식을 브라우저 메모리에서 다루고, 결과는 **다운로드**로 가져갑니다.

## 스택

- Vue 3 + Vite + TypeScript, 정적 빌드(`packages/frontend/dist`)
- 뷰어·OCR·PDF.js worker 등은 `/viewer-assets/`에 **자체 호스팅** (빌드 때 복사·내려받기, 런타임 CDN fetch 없음)
- 배포: `.github/workflows/pages.yml` — `main` push 시 빌드 → GitHub Pages. 절대 경로(`/viewer-assets/`)를 쓰므로 사용자 도메인 루트(예 `office.sejong.dev`)에 둔다

## 오피스 편집기 연결

오피스·PDF는 `editor.sejong.dev`(GitHub Pages, [sejongY00/office-editor](https://github.com/sejongY00/office-editor))의 ranuts 편집기를 iframe으로 넣고, 파일 바이트를 `postMessage`(`document:open-buffer` / `document:save`)로 주고받습니다(ranuts `docs/embed-api.md`). 파일은 어디에도 업로드되지 않습니다.

- **두 사이트 모두 COOP/COEP 헤더가 없어야 동작합니다.** 격리된 부모는 COEP 없는 편집기 프레임을 막고, COEP를 보내는 편집기(예: 공식 edit.chaxus.com)는 비격리 부모 안에서 파일 열기가 실패합니다(2026-11 시험). GitHub Pages는 헤더를 보내지 않으므로 지금 구성이 맞습니다
- 편집기는 **도메인 루트**에 있어야 합니다. ranuts가 `/sdkjs/…` 루트 절대 경로를 써서 하위 경로에선 변환 엔진(x2t)이 404
- ranuts는 `document:ready`를 놓칠 수 있어, 부모가 `document:get-state`를 보내 응답이 오면 파일을 엽니다
- iframe 안의 편집기는 브라우저 캐시가 사이트별로 나뉘어, 처음 한 번은 엔진(약 60MB)을 새로 받습니다

편집기 주소는 빌드 때 `VITE_OFFICE_EDITOR_URL`(저장소 변수 `OFFICE_EDITOR_URL`)로 바꿀 수 있고, 기본값은 `https://editor.sejong.dev/`입니다.

## 로컬 개발

```bash
npm install
# predev 가 viewer-assets(CAD·3D·스캐너·OCR 모델)를 복사합니다
npm run dev        # http://localhost:5173
npm run build      # packages/frontend/dist
```

## 문서 스캐너 (`/tools/scanner`)

브라우저에서만 동작합니다.

- **입력**: PNG/JPEG/WebP 등 이미지, 카메라, **다페이지 PDF**(PDF.js로 페이지 래스터화)
- **보정**: 문서 코너 검출·드래그 수정·원근 보정 (jscanify / OpenCV.js)
- **OCR**: PP-OCRv5 Korean (한글·영문), ONNX Runtime Web (WebGPU 우선)
- **목록**: 하단 드롭으로 추가, 드래그로 **순서 변경**
- **저장**: 목록 순서대로 검색 가능 PDF(투명 텍스트 레이어), 또는 PNG로 저장

## 라이선스 고지

앱 내 `/licenses` 에서 상세 고지를 볼 수 있습니다.

- **본 앱: GPL-3.0-only** (LibreDWG / MLightCAD DWG 경로 포함)
- ranuts/document (오피스 편집기, 별도 사이트에서 iframe): AGPL-3.0
- rhwp: MIT — Hancom 상표와 무관한 독립 프로젝트
- Online 3D Viewer · ppu-paddle-ocr · pdf-lib 등: 각 패키지 라이선스(MIT/Apache-2.0 등)
- PDF.js: Apache-2.0 · PaddleOCR 모델: Apache-2.0

## 포맷 안내

| 확장자 | 엔진 | 비고 |
|--------|------|------|
| hwp, hwpx | rhwp | 원본 확장자로 export |
| pdf, docx, xlsx, pptx 등 | ranuts/document | iframe, 툴바 다운로드 또는 편집기 파일 → 다운로드 방법 |
| dxf, dwg | MLightCAD | 클라이언트 뷰어 · 한글 폴백 글꼴(Noto Sans KR) |
| glTF, OBJ, STEP, IFC, STL, 3DM 등 | Online 3D Viewer | `/viewer-assets/o3dv/` 자체 호스팅 |
| png, jpg, webp, … / pdf(스캐너) | 문서 스캐너 | OCR PDF·PNG 다운로드 |

홈에서 PDF를 열면 오피스 편집기로 가고, 스캐너에서 PDF를 열면 **페이지 이미지로 변환 후 OCR·재저장**합니다.

rhwp는 v0.7.x 기준이며, 복잡한 공공문서에서 한컴과 조판이 다를 수 있습니다.
