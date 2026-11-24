# Sejong Office (`sejong-office`)

[![Latest Release](https://img.shields.io/github/v/release/sejongY00/sejong-office)](https://github.com/sejongY00/sejong-office/releases/latest)
[![Deploy to GitHub Pages](https://github.com/sejongY00/sejong-office/actions/workflows/pages.yml/badge.svg)](https://github.com/sejongY00/sejong-office/actions/workflows/pages.yml)
[![Release Desktop App](https://github.com/sejongY00/sejong-office/actions/workflows/release-desktop.yml/badge.svg)](https://github.com/sejongY00/sejong-office/actions/workflows/release-desktop.yml)
[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](./LICENSE)
[![Web App](https://img.shields.io/badge/Web%20App-office.sejong.dev-2563eb)](https://office.sejong.dev)

> **서버 업로드 없는 100% 로컬·오프라인 문서 작업 환경**  
> 오피스 문서(Word · Excel · PowerPoint · PDF), 한글(HWP · HWPX), 다이어그램, 도면(CAD · 3D), 디자인 파일, 문서 스캐너·OCR을 브라우저와 데스크톱에서 외부 서버 전송 없이 바로 열고 편집합니다.

- 🌐 **웹 앱 바로 열기**: [https://office.sejong.dev](https://office.sejong.dev)
- 💻 **데스크톱 앱 다운로드 (macOS · Windows)**: [GitHub Releases 최신 버전](https://github.com/sejongY00/sejong-office/releases/latest)

---

## 핵심 원칙

- **Zero Server Upload**: 모든 파일은 브라우저 메모리 또는 사용자 기기 로컬에서만 처리되며 외부 서버로 전송되지 않습니다.
- **100% 오프라인 지원**: 웹 앱은 핵심 뷰어·OCR·글꼴 자산을 자체 호스팅(PWA)하며, 데스크톱 앱은 OnlyOffice/RHWP 엔진과 한글 글꼴을 설치 패키지에 내장해 인터넷 없이 즉시 실행됩니다.
- **원본 직접 저장 (In-place Save)**: 데스크톱 앱과 File System Access API 지원 브라우저(Chrome · Edge · Whale 등)에서는 연 파일을 원본 위치에 바로 덮어쓸 수 있으며, 미지원 브라우저는 안전한 파일 다운로드로 폴백합니다.

---

## 웹 앱(PWA) vs 데스크톱 앱(Electron)

| 구분 | 웹 앱 (PWA) | 데스크톱 앱 (Electron) |
| --- | --- | --- |
| **접속 / 설치** | [office.sejong.dev](https://office.sejong.dev) 즉시 실행 · 브라우저 PWA 설치 | [GitHub Releases](https://github.com/sejongY00/sejong-office/releases/latest)에서 macOS(`.dmg`) / Windows(`.exe`) 설치 |
| **오피스 · PDF 편집** | 지원 (OnlyOffice + `x2t` WASM) | 지원 (설치 패키지에 오프라인 번들 내장) |
| **한글 (HWP · HWPX)** | 지원 (`@rhwp/editor`) | 지원 (설치 패키지에 오프라인 번들 내장) |
| **다이어그램** | Excalidraw · Mermaid · draw.io | — (웹 앱 전용) |
| **전문 뷰어** | CAD(DXF/DWG) · 3D · AI · PSD · Markdown | — (웹 앱 전용) |
| **이미지 · 스캔 도구** | 문서 스캐너(OCR) · 배경 제거 · 이미지 편집 | — (웹 앱 전용) |
| **오프라인 동작** | 정적 자산 자체 호스팅 (최초 엔진 캐시 필요) | **설치 직후 인터넷 없이 100% 오프라인 동작** |
| **한글 글꼴 내장** | Pretendard · Noto Sans KR(CAD 폴백) 자체 호스팅 | 나눔고딕 · 나눔바른고딕 · 나눔스퀘어 · 나눔명조 내장 + 맑은 고딕·바탕·돋움·굴림·함초롬·Calibri 등 자동 매핑 |
| **OS 통합** | 웹 앱 수준 (PWA 파일 핸들러) | OS 기본 앱 연결 & 확장자별 전용 아이콘 (더블클릭 즉시 열기) |
| **최근 파일** | — (데스크톱 앱 전용) | 최대 5개 (로컬 파일 경로 기반, 개별·전체 삭제 및 사용 안 함 설정) |
| **업데이트** | `main` 푸시 시 GitHub Pages 자동 배포 | 하이브리드 자동 업데이트 (Windows `electron-updater` 델타 설치 / macOS GitHub Releases API `.dmg` 다운로드) |

---

## 데스크톱 앱 다운로드 및 설치

[최신 릴리스 페이지](https://github.com/sejongY00/sejong-office/releases/latest)에서 운영체제에 맞는 설치 파일을 받으세요.

| 플랫폼 | 아키텍처 | 설치 파일 패턴 |
| --- | --- | --- |
| **macOS** | Apple Silicon (`arm64`) | `Sejong-Office-<version>-mac-arm64.dmg` |
| **macOS** | Intel (`x64`) | `Sejong-Office-<version>-mac-x64.dmg` |
| **Windows** | 64-bit (`x64`) | `Sejong-Office-<version>-win-x64.exe` (NSIS) |

> **macOS 비서명 앱 설치 안내**  
> 데스크톱 앱은 Apple Developer 코드 서명 없이 배포됩니다. 최초 실행 시 *"확인되지 않은 개발자"* 또는 *"손상되어 열 수 없음"* 경고가 표시되면, 앱을 우클릭 → **열기**로 실행하거나 터미널에서 아래 명령으로 격리 속성을 해제한 뒤 실행하세요.
>
> ```bash
> xattr -cr "/Applications/Sejong Office.app"
> ```

---

## 지원 포맷 안내

| 분류 | 지원 확장자 | 엔진 / 라이브러리 | 비고 |
| --- | --- | --- | --- |
| **오피스 / PDF** | `docx`, `doc`, `dotx`, `odt`, `rtf`, `txt`, `xlsx`, `xls`, `xltx`, `ods`, `csv`, `pptx`, `ppt`, `potx`, `odp`, `pdf` | [ranuts/document](https://github.com/ranuts/document) (ONLYOFFICE + `x2t` WASM) | 웹/데스크톱 공통, 원본 저장 또는 다운로드 |
| **한글 문서** | `hwp`, `hwpx` | [rhwp](https://github.com/edwardkim/rhwp) (`@rhwp/editor`) | 웹/데스크톱 공통, 원본 확장자로 저장 |
| **다이어그램** | `excalidraw`, `mmd`, `mermaid`, `drawio`, `xml` | Excalidraw · Mermaid · draw.io | 웹 앱 전용 |
| **CAD 도면** | `dxf`, `dwg` | [MLightCAD](https://github.com/mlightcad/cad-viewer) (LibreDWG) | 웹 앱 전용, 한글 폴백 글꼴(Noto Sans KR) |
| **3D 모델** | `gltf`, `glb`, `obj`, `stl`, `step`, `stp`, `iges`, `igs`, `ifc`, `3dm`, `fbx`, `dae`, `3ds`, `3mf`, `ply`, `off`, `amf`, `bim`, `brep`, `brp`, `fcstd`, `wrl`, `zip` | [Online 3D Viewer](https://github.com/kovacsv/Online3DViewer) | 웹 앱 전용, `/viewer-assets/o3dv/` 자체 호스팅 |
| **디자인 / 마크다운** | `ai`, `psd`, `md`, `markdown`, `mdown` | PDF.js(`ai`) · `ag-psd`(`psd`) · `marked` + `DOMPurify`(`md`) | 웹 앱 전용 |
| **문서 스캐너** | `png`, `jpg`, `jpeg`, `webp`, `gif`, `bmp`, `pdf` | jscanify + OpenCV.js · [ppu-paddle-ocr](https://github.com/PT-Perkasa-Pilar-Utama/ppu-paddle-ocr) · PDF.js | 웹 앱 전용 (`/tools/scanner`) |
| **이미지 / 배경 제거** | `png`, `jpg`, `jpeg`, `webp`, `gif`, `bmp`, `ico` | Canvas 로컬 처리 | 웹 앱 전용 (`/tools/bg-remove`, `/tools/image-edit`) |

- 홈 화면에서 PDF를 열면 **오피스 편집기**로 열리고, 문서 스캐너(`/tools/scanner`)에서 PDF를 열면 **페이지 이미지로 래스터화한 뒤 OCR·재저장**합니다.
- `@rhwp/editor`는 `^0.9.0` 기준이며, 복잡한 공공문서에서는 한컴오피스와 조판 결과가 일부 다를 수 있습니다.

### 문서 스캐너 (`/tools/scanner`)

- **입력**: PNG · JPEG · WebP 등 이미지, 카메라 촬영, **다페이지 PDF**(PDF.js 페이지 래스터화)
- **보정**: 문서 코너 자동 검출 · 드래그 수동 조정 · 원근 보정 (`jscanify` / OpenCV.js)
- **OCR**: PP-OCRv5 Korean (한글 · 영문), ONNX Runtime Web (WebGPU 우선)
- **페이지 관리**: 하단 드롭으로 페이지 추가, 드래그로 순서 변경
- **저장**: 목록 순서대로 검색 가능한 PDF(투명 텍스트 레이어) 또는 PNG 저장

---

## 아키텍처 및 엔진 연동 참고

### 기술 스택 및 저장소 구조

- **모노레포 (npm workspaces)**:
  - `packages/frontend` (`@sejong-office/frontend`): Vue 3 + Vite + TypeScript 정적 빌드 (`packages/frontend/dist`). 뷰어·OCR·PDF.js worker는 `/viewer-assets/`에, Pretendard 글꼴은 번들에 포함해 **자체 호스팅**(런타임 CDN fetch 없음).
  - `packages/desktop` (`@sejong-office/desktop`): Electron 35 + `electron-builder` 기반 데스크톱 래퍼. `build:desktop`(`__DESKTOP_ONLY__`)로 문서 편집기 중심으로 번들링하고, OnlyOffice/RHWP 오프라인 에셋 및 한글 글꼴 패치(`koreanFontsPatch.cjs`)를 함께 패키징.
- **GitHub Pages 배포 (`.github/workflows/pages.yml`)**: `main` 브랜치 푸시 시 테스트(`npm test`) → 빌드(`npm run build`) → `404.html` SPA 폴백 복사 → GitHub Pages 배포. `/viewer-assets/` 절대 경로를 사용하므로 사용자 도메인 루트(`https://office.sejong.dev`)에 호스팅합니다.

### 오피스 편집기 (OnlyOffice / `ranuts/document`) 연동

오피스·PDF 편집은 [sejongY00/office-editor](https://github.com/sejongY00/office-editor)에서 빌드·배포하는 `https://editor.sejong.dev/`(GitHub Pages)의 `ranuts/document` 편집기를 iframe으로 임베드하고, 파일 바이트를 `postMessage`(`document:open-buffer` / `document:save`, `ranuts` `docs/embed-api.md`)로 주고받습니다.

- **COOP/COEP 헤더 금지**: 두 사이트 모두 COOP/COEP 헤더가 없어야 동작합니다. 격리된 부모는 COEP 없는 편집기 프레임을 차단하고, COEP를 보내는 편집기(예: 공식 `edit.chaxus.com`)는 비격리 부모 안에서 파일 열기가 실패합니다. GitHub Pages는 해당 헤더를 보내지 않으므로 현재 구성이 적합합니다.
- **도메인 루트 필수**: `ranuts`가 `/sdkjs/…` 루트 절대 경로를 사용하므로 하위 경로(예: `/office-editor/`)에서는 변환 엔진(`x2t` WASM)이 404 오류를 냅니다.
- **초기화 핸드셰이크**: `document:ready` 이벤트가 누락될 수 있어 부모가 `document:get-state`를 전송하고 응답이 오면 파일을 엽니다.
- **초기 캐시**: 웹 iframe은 브라우저 캐시가 사이트별로 분리되어 최초 1회는 엔진(약 60MB)을 새로 내려받습니다. (데스크톱 앱은 오프라인 번들에 내장)
- **URL 재정의**: 빌드 시 `VITE_OFFICE_EDITOR_URL`(GitHub Actions 저장소 변수 `OFFICE_EDITOR_URL`, 끝 슬래시 포함)로 변경할 수 있으며 기본값은 `https://editor.sejong.dev/`입니다.

### 한글 편집기 (RHWP) 연동

- `@rhwp/editor` iframe으로 `rhwp-studio`를 임베드합니다. 기본 URL은 `https://sejongy00.github.io/rhwp/`이며 빌드 시 `VITE_RHWP_STUDIO_URL`로 재정의할 수 있습니다.
- 데스크톱 앱은 오프라인 RHWP 번들과 내장 나눔 글꼴을 로컬 프로토콜/캐시 인터셉터(`offlineCache.cjs`)로 제공해 오프라인에서도 동일하게 동작합니다.

---

## 로컬 개발 · 빌드 · 테스트 · 릴리스

요구 환경: **Node.js >= 20** (GitHub Actions CI는 Node.js 24 사용)

### 1. 설치 및 웹 앱 개발

```bash
npm install

# predev 가 viewer-assets(CAD · 3D · 스캐너 · OCR 모델)를 준비합니다
npm run dev        # http://localhost:5173

# 정적 프로덕션 빌드 (vue-tsc --noEmit && vite build → packages/frontend/dist)
npm run build
npm run preview
```

### 2. 테스트

```bash
# 프론트엔드(Vitest) + 데스크톱(node --test) 전체 단위 테스트
npm test

# 워크스페이스별 개별 실행
npm run test -w @sejong-office/frontend
npm run test -w @sejong-office/desktop
```

### 3. 데스크톱 앱 개발 및 패키징

```bash
# 아이콘 생성 → 데스크톱 프론트엔드 빌드 → 오프라인 에셋 복사 후 Electron 실행
npm run desktop:dev

# 설치 파일 생성 없이 패키징 디렉터리 검증 (--dir --publish never)
npm run desktop:pack

# 현재 OS용 설치 파일 생성 (packages/desktop/release/)
npm run desktop:dist

# 번들 준비만 단독 실행
npm run prepare:bundle -w @sejong-office/desktop
```

### 4. 업스트림 동기화 확인 (선택)

로컬 형제 디렉터리의 `document`(OnlyOffice) 및 `rhwp` 저장소 업스트림 커밋을 확인하거나 병합합니다.

```bash
npm run sync:upstreams
npm run sync:upstreams -- --merge
```

### 5. 태그 기반 데스크톱 릴리스 플로우 (`v*`)

`v*` 형식의 Git 태그를 푸시하면 [`.github/workflows/release-desktop.yml`](./.github/workflows/release-desktop.yml)가 자동으로 실행됩니다.

```bash
git tag v0.1.6
git push origin v0.1.6
```

1. `npm ci` 및 `npm test` 실행
2. 태그 이름(`vX.Y.Z`)에 맞춰 루트 및 워크스페이스 `package.json` 버전 자동 동기화
3. macOS(`arm64` / `x64` `.dmg`, `.zip`) 및 Windows(`x64` `.exe`, `.blockmap`, `latest*.yml`) 빌드
4. GitHub Releases 자동 생성 및 설치 파일 업로드 (`workflow_dispatch` 수동 실행 지원)

---

## 라이선스

- 본 프로젝트는 **[GNU General Public License v3.0 (`GPL-3.0-only`)](./LICENSE)** 라이선스를 따릅니다 (LibreDWG / MLightCAD DWG 경로 포함).
- 서드파티 오픈소스 라이브러리 및 내장 글꼴의 라이선스 고지는 **[THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md)** 및 앱 내 `/licenses` 화면에서 확인할 수 있습니다.
