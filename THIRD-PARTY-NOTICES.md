# 서드파티 라이선스 및 고지

**Sejong Office (`sejong-office`)**는 **GNU General Public License v3.0 only (`GPL-3.0-only`)** 라이선스로 배포됩니다. 라이선스 전문은 [LICENSE](./LICENSE)를 참고하세요.

이 프로젝트는 웹 앱(`@sejong-office/frontend`)과 Electron 데스크톱 앱(`@sejong-office/desktop`)에 아래의 오픈소스 소프트웨어와 글꼴을 번들·임베드하거나 의존합니다.

---

## 1. 오피스 및 문서 편집기

| 구성요소 | 라이선스 | 원본 저장소 / 링크 | 비고 |
| --- | --- | --- | --- |
| **ranuts/document** (ONLYOFFICE Editor + x2t WebAssembly) | `AGPL-3.0` | [ranuts/document](https://github.com/ranuts/document) | 웹에서는 iframe으로([sejongY00/document](https://github.com/sejongY00/document)) 임베드하고, 데스크톱에서는 오프라인으로 번들되는 클라이언트 측 오피스/PDF 편집기입니다. |
| **ONLYOFFICE DocumentServer** (upstream) | `AGPL-3.0` | [ONLYOFFICE/DocumentServer](https://github.com/ONLYOFFICE/DocumentServer) | `ranuts/document`의 원본(upstream) 편집기 SDK·엔진입니다. ONLYOFFICE는 Ascensio System SIA의 상표이며 본 프로젝트와 제휴 관계가 없습니다. |
| **rhwp** (`@rhwp/editor`, `@rhwp/core`) | `MIT` | [edwardkim/rhwp](https://github.com/edwardkim/rhwp) | 클라이언트 측 HWP/HWPX 뷰어 및 편집기입니다(웹은 [sejongY00/rhwp](https://github.com/sejongY00/rhwp) iframe, 데스크톱은 오프라인 번들 사용). 주식회사 한글과컴퓨터와 제휴 관계가 없는 독립 프로젝트입니다. |

---

## 2. 데스크톱 앱 (Electron 및 패키징)

| 구성요소 | 라이선스 | 원본 저장소 / 링크 | 비고 |
| --- | --- | --- | --- |
| **Electron** | `MIT` | [electron/electron](https://github.com/electron/electron) | 크로스 플랫폼 데스크톱 런타임(`packages/desktop`). |
| **electron-updater** | `MIT` | [electron-userland/electron-builder](https://github.com/electron-userland/electron-builder) | 데스크톱 릴리즈 자동 업데이트 지원. |
| **electron-builder** | `MIT` | [electron-userland/electron-builder](https://github.com/electron-userland/electron-builder) | macOS(`.dmg`/`.zip`) 및 Windows(`.exe` NSIS) 패키징(빌드 타임). |
| **sharp** | `Apache-2.0` | [lovell/sharp](https://github.com/lovell/sharp) | 데스크톱 아이콘 생성 시 사용하는 고속 이미지 리사이징 라이브러리(`packages/desktop/scripts/generate-desktop-icons.mjs`). |

---

## 3. 다이어그램

| 구성요소 | 라이선스 | 원본 저장소 / 링크 | 비고 |
| --- | --- | --- | --- |
| **Excalidraw** (`@excalidraw/excalidraw`) | `MIT` | [excalidraw/excalidraw](https://github.com/excalidraw/excalidraw) | 인터랙티브 화이트보드 및 다이어그램 편집기(자체 호스팅 에셋). |
| **Mermaid** (`mermaid`) | `MIT` | [mermaid-js/mermaid](https://github.com/mermaid-js/mermaid) | 텍스트 기반 다이어그램 렌더러. |
| **diagrams.net / draw.io** | `Apache-2.0` | [jgraph/drawio](https://github.com/jgraph/drawio) | `embed.diagrams.net`을 통해 임베드되는 다이어그램 편집기(`postMessage` 데이터 교환). |

---

## 4. CAD 및 3D 뷰어

| 구성요소 | 라이선스 | 원본 저장소 / 링크 | 비고 |
| --- | --- | --- | --- |
| **MLightCAD CAD Viewer** (`@mlightcad/cad-viewer`, `cad-simple-viewer`, plugins) | `MIT` | [mlightcad/cad-viewer](https://github.com/mlightcad/cad-viewer) | 브라우저 기반 DXF/DWG 렌더러 및 뷰어 UI. |
| **@mlightcad/data-model** | `MIT` | [mlightcad/realdwg-web](https://github.com/mlightcad/realdwg-web) | CAD 엔티티 및 도면 데이터 모델. |
| **@mlightcad/dxf-json-converter** | `GPL-3.0` | [mlightcad/realdwg-web](https://github.com/mlightcad/realdwg-web) | DXF/DWG 파서 및 변환기. |
| **GNU LibreDWG** | `GPL-3.0` | [gnu.org/software/libredwg](https://www.gnu.org/software/libredwg/) | MLightCAD의 `libredwg-parser-worker.js`에 번들되어 있으며, 이에 따라 본 앱도 GPL-3.0으로 배포됩니다. |
| **Online 3D Viewer** (`online-3d-viewer`) | `MIT` | [kovacsv/Online3DViewer](https://github.com/kovacsv/Online3DViewer) | `/viewer-assets/o3dv/`에 자체 호스팅된 외부 로더를 사용하는 3D 모델 뷰어 엔진. |
| **Three.js** (`three`) | `MIT` | [mrdoob/three.js](https://github.com/mrdoob/three.js) | WebGL 3D 렌더링 엔진. |
| **occt-import-js** (Open CASCADE Technology) | `LGPL-2.1` | [kovacsv/occt-import-js](https://github.com/kovacsv/occt-import-js) | STEP / IGES / BREP 임포터(자체 호스팅 WASM; OCCT 예외 조항 포함 LGPL-2.1). |
| **web-ifc** | `MPL-2.0` | [ThatOpen/engine_web-ifc](https://github.com/ThatOpen/engine_web-ifc) | IFC BIM 모델 로더(자체 호스팅 WASM). |
| **rhino3dm** | `MIT` | [mcneel/rhino3dm](https://github.com/mcneel/rhino3dm) | Rhino `.3dm` 지오메트리 로더(자체 호스팅 WASM). |
| **Draco** (`draco3d`) | `Apache-2.0` | [google/draco](https://github.com/google/draco) | 3D 메시 압축 디코더. |
| **fflate** | `MIT` | [101arrowz/fflate](https://github.com/101arrowz/fflate) | 고속 ZIP/deflate 압축 해제 라이브러리. |
| **Fisherman's Bastion Envmap** (Emil Persson / Humus) | `CC-BY-3.0` | [creativecommons.org/licenses/by/3.0](https://creativecommons.org/licenses/by/3.0/) | Online 3D Viewer에 번들된 환경 큐브맵(`http://www.humus.name`). |

---

## 5. 문서 스캐너, OCR, PDF 및 미디어 뷰어

| 구성요소 | 라이선스 | 원본 저장소 / 링크 | 비고 |
| --- | --- | --- | --- |
| **jscanify** | `MIT` | [puffinsoft/jscanify](https://github.com/puffinsoft/jscanify) | 문서 모서리 검출 및 원근 보정. |
| **OpenCV.js** | `Apache-2.0` | [opencv/opencv](https://github.com/opencv/opencv) | 스캐너 경계 검출·와핑을 위한 컴퓨터 비전 런타임(자체 호스팅). |
| **ppu-paddle-ocr** | `MIT` | [PT-Perkasa-Pilar-Utama/ppu-paddle-ocr](https://github.com/PT-Perkasa-Pilar-Utama/ppu-paddle-ocr) | 브라우저용 PaddleOCR 파이프라인 래퍼. |
| **PaddleOCR Models (PP-OCRv5 Korean)** | `Apache-2.0` | [PaddlePaddle/PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR) | 문자 검출, 한국어 인식 ONNX 모델 및 사전([ppu-paddle-ocr-models](https://github.com/PT-Perkasa-Pilar-Utama/ppu-paddle-ocr-models) 경유 패키징). |
| **ONNX Runtime Web** (`onnxruntime-web`) | `MIT` | [microsoft/onnxruntime](https://github.com/microsoft/onnxruntime) | OCR용 클라이언트 측 WASM/WebGPU 추론 런타임. |
| **PDF.js** (`pdfjs-dist`) | `Apache-2.0` | [mozilla/pdf.js](https://github.com/mozilla/pdf.js) | 문서 스캐너 및 PDF 호환 `.ai` 뷰어의 PDF 래스터화 엔진. |
| **pdf-lib** & **@pdf-lib/fontkit** | `MIT` | [Hopding/pdf-lib](https://github.com/Hopding/pdf-lib) / [Hopding/fontkit](https://github.com/Hopding/fontkit) | 검색 가능한 OCR PDF 생성 및 글꼴 임베딩. |
| **ag-psd** | `MIT` | [Agamnentzar/ag-psd](https://github.com/Agamnentzar/ag-psd) | Adobe Photoshop(`.psd`) 파일 리더. |
| **marked** | `MIT` | [markedjs/marked](https://github.com/markedjs/marked) | 마크다운 파서. |
| **DOMPurify** | `MPL-2.0 OR Apache-2.0` | [cure53/DOMPurify](https://github.com/cure53/DOMPurify) | 마크다운 렌더링용 HTML 새니타이저. |

---

## 6. 프론트엔드 프레임워크 및 핵심 라이브러리

| 구성요소 | 라이선스 | 원본 저장소 / 링크 |
| --- | --- | --- |
| **Vue** (`vue`) | `MIT` | [vuejs/core](https://github.com/vuejs/core) |
| **Vue Router** (`vue-router`) | `MIT` | [vuejs/router](https://github.com/vuejs/router) |
| **VueUse** (`@vueuse/core`) | `MIT` | [vueuse/vueuse](https://github.com/vueuse/vueuse) |
| **Vue I18n** (`vue-i18n`) | `MIT` | [intlify/vue-i18n](https://github.com/intlify/vue-i18n) |
| **Element Plus** (`element-plus`, `@element-plus/icons-vue`) | `MIT` | [element-plus/element-plus](https://github.com/element-plus/element-plus) |
| **React** & **React DOM** (`react`, `react-dom`) | `MIT` | [facebook/react](https://github.com/facebook/react) |
| **lodash-es** | `MIT` | [lodash/lodash](https://github.com/lodash/lodash) |
| **Vite** / **Vitest** | `MIT` | [vitejs/vite](https://github.com/vitejs/vite) / [vitest-dev/vitest](https://github.com/vitest-dev/vitest) |
| **TypeScript** | `Apache-2.0` | [microsoft/TypeScript](https://github.com/microsoft/TypeScript) |

---

## 7. 내장 및 번들 글꼴

Sejong Office는 상용 독점 글꼴(맑은 고딕, 바탕, 돋움, 굴림, Calibri, Cambria, Consolas, AutoCAD SHX 등)을 재배포하지 않습니다. 대신 오픈소스 글꼴을 내장하고, 문서 내 일반 글꼴 이름을 크기·스타일이 호환되는 오픈소스 글꼴로 자동 매핑합니다([`packages/desktop/src/koreanFontsPatch.cjs`](./packages/desktop/src/koreanFontsPatch.cjs) 및 [`packages/frontend/src/config/koreanFonts.ts`](./packages/frontend/src/config/koreanFonts.ts) 참고).

### 한국어 글꼴

| 글꼴 패밀리 | 라이선스 | 원본 출처 | 용도 |
| --- | --- | --- | --- |
| **나눔글꼴** (`NanumGothic`, `NanumBarunGothic`, `NanumSquare`, `NanumMyeongjo`) | `OFL-1.1` (SIL Open Font License 1.1) | [네이버 나눔글꼴](https://hangeul.naver.com/font) / [naver/nanumfont](https://github.com/naver/nanumfont) | 데스크톱 오프라인 오피스/RHWP 번들에 Regular·Bold 글꼴을 내장하며, 주요 한글 문서 글꼴(`맑은 고딕`, `바탕`, `돋움`, `굴림`, `궁서`, `함초롬바탕`, `함초롬돋움` 등)의 자동 대체 글꼴로 사용됩니다. |
| **Pretendard** (`pretendard`) | `OFL-1.1` | [orioncactus/pretendard](https://github.com/orioncactus/pretendard) | 웹과 데스크톱 앱의 기본 UI 글꼴로 자체 호스팅됩니다. |
| **Noto Sans KR** (`@noto-pdf-ts/fonts-kr`, `@fontsource-variable/noto-sans-kr`) | `OFL-1.1` | [notofonts/noto-cjk](https://github.com/notofonts/noto-cjk) | MLightCAD 뷰어의 한국어 대체 글꼴로 자체 호스팅됩니다(`/viewer-assets/cad-resources/fonts/`). |

### 영문 및 기호 글꼴 (데스크톱 오프라인 오피스 카탈로그)

데스크톱 오프라인 OnlyOffice 번들(`packages/desktop/scripts/copy-web-dist.mjs`)에는 원본 OnlyOffice 글꼴 카탈로그의 핵심 영문·기호 글꼴이 포함됩니다.

| 글꼴 패밀리 | 라이선스 | 원본 출처 | 비고 |
| --- | --- | --- | --- |
| **Carlito** | `OFL-1.1` | [googlefonts/carlito](https://github.com/googlefonts/carlito) | Calibri / Aptos / Segoe UI와 메트릭이 호환되는 오픈소스 대체 글꼴. |
| **Caladea** | `Apache-2.0` | [Google Fonts — Caladea](https://fonts.google.com/specimen/Caladea) | Cambria와 메트릭이 호환되는 오픈소스 대체 글꼴. |
| **Liberation Fonts** (`Liberation Sans`, `Liberation Serif`, `Liberation Mono`) | `OFL-1.1` | [liberationfonts/liberation-fonts](https://github.com/liberationfonts/liberation-fonts) | Arial, Times New Roman, Consolas/Courier New와 메트릭이 호환되는 오픈소스 대체 글꼴. |
| **DejaVu Fonts** | `DejaVu / Bitstream Vera License` | [dejavu-fonts/dejavu-fonts](https://github.com/dejavu-fonts/dejavu-fonts) | 다국어 및 기호 지원 기본 글꼴. |
| **Noto Sans** | `OFL-1.1` | [notofonts](https://github.com/notofonts/notofonts.github.io) | 기본 유니코드 폴백 글꼴. |
| **OpenSymbol** | `MPL-2.0` / `LGPL-3.0-or-later` | [LibreOffice](https://www.libreoffice.org/) | 원본 OnlyOffice 핵심 글꼴에 포함된 수학·글머리 기호 글꼴. |

---

## 8. 상표권 고지

- **Microsoft**, **Office**, **Word**, **Excel**, **PowerPoint**, **Calibri**, **Cambria**, **Consolas**, **Malgun Gothic**은 Microsoft Corporation의 상표 또는 등록 상표입니다.
- **ONLYOFFICE**는 Ascensio System SIA의 상표입니다.
- **한글**, **한컴**, **HWP**, **HWPX**는 주식회사 한글과컴퓨터(Hancom Inc.)의 등록 상표입니다.
- **AutoCAD**, **DWG**는 Autodesk, Inc.의 상표입니다.
- **Adobe**, **Photoshop**, **Illustrator**는 Adobe Inc.의 상표입니다.

Sejong Office는 독립적인 오픈소스 프로젝트이며, 위의 어떤 상표권자와도 제휴·후원·승인 관계가 없습니다.
