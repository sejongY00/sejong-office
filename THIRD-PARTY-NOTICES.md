# Third-Party Notices

**Sejong Office (`sejong-office`)** is distributed under the **GNU General Public License v3.0 only (`GPL-3.0-only`)**. See [LICENSE](./LICENSE) for the full license text.

This project bundles, embeds, or depends on the following third-party open-source software and fonts across the web app (`@sejong-office/frontend`) and the Electron desktop app (`@sejong-office/desktop`).

---

## 1. Office & Document Editors

| Component | License | Upstream Repository / Link | Notes |
| --- | --- | --- | --- |
| **ranuts/document** (ONLYOFFICE Editor + x2t WebAssembly) | `AGPL-3.0` | [ranuts/document](https://github.com/ranuts/document) | Client-side Office/PDF editor embedded via iframe in Web (`sejongY00/office-editor`) and bundled offline in Desktop. |
| **ONLYOFFICE DocumentServer** (upstream) | `AGPL-3.0` | [ONLYOFFICE/DocumentServer](https://github.com/ONLYOFFICE/DocumentServer) | Upstream editor SDK/engine for `ranuts/document`. ONLYOFFICE is a trademark of Ascensio System SIA; no affiliation. |
| **rhwp** (`@rhwp/editor`, `@rhwp/core`) | `MIT` | [edwardkim/rhwp](https://github.com/edwardkim/rhwp) | Client-side HWP/HWPX viewer & editor (Web iframe / Desktop offline bundle). Independent project, not affiliated with Hancom Inc. |

---

## 2. Desktop Application (Electron & Packaging)

| Component | License | Upstream Repository / Link | Notes |
| --- | --- | --- | --- |
| **Electron** | `MIT` | [electron/electron](https://github.com/electron/electron) | Cross-platform desktop runtime (`packages/desktop`). |
| **electron-updater** | `MIT` | [electron-userland/electron-builder](https://github.com/electron-userland/electron-builder) | Automatic update support for desktop releases. |
| **electron-builder** | `MIT` | [electron-userland/electron-builder](https://github.com/electron-userland/electron-builder) | macOS (`.dmg`/`.zip`) and Windows (`.exe` NSIS) packaging (build-time). |
| **sharp** | `Apache-2.0` | [lovell/sharp](https://github.com/lovell/sharp) | High-speed image resizing used during desktop icon generation (`packages/desktop/scripts/generate-desktop-icons.mjs`). |

---

## 3. Diagrams

| Component | License | Upstream Repository / Link | Notes |
| --- | --- | --- | --- |
| **Excalidraw** (`@excalidraw/excalidraw`) | `MIT` | [excalidraw/excalidraw](https://github.com/excalidraw/excalidraw) | Interactive whiteboard / diagram editor (self-hosted assets). |
| **Mermaid** (`mermaid`) | `MIT` | [mermaid-js/mermaid](https://github.com/mermaid-js/mermaid) | Text-to-diagram renderer. |
| **diagrams.net / draw.io** | `Apache-2.0` | [jgraph/drawio](https://github.com/jgraph/drawio) | Embedded diagram editor via `embed.diagrams.net` (`postMessage` data exchange). |

---

## 4. CAD & 3D Viewers

| Component | License | Upstream Repository / Link | Notes |
| --- | --- | --- | --- |
| **MLightCAD CAD Viewer** (`@mlightcad/cad-viewer`, `cad-simple-viewer`, plugins) | `MIT` | [mlightcad/cad-viewer](https://github.com/mlightcad/cad-viewer) | Browser-based DXF/DWG renderer and viewer UI. |
| **@mlightcad/data-model** | `MIT` | [mlightcad/realdwg-web](https://github.com/mlightcad/realdwg-web) | CAD entity/drawing data model. |
| **@mlightcad/dxf-json-converter** | `GPL-3.0` | [mlightcad/realdwg-web](https://github.com/mlightcad/realdwg-web) | DXF/DWG parser & converter. |
| **GNU LibreDWG** | `GPL-3.0` | [gnu.org/software/libredwg](https://www.gnu.org/software/libredwg/) | Bundled inside MLightCAD's `libredwg-parser-worker.js`; requires GPL-3.0 distribution of this application. |
| **Online 3D Viewer** (`online-3d-viewer`) | `MIT` | [kovacsv/Online3DViewer](https://github.com/kovacsv/Online3DViewer) | 3D model viewer engine with self-hosted external loaders under `/viewer-assets/o3dv/`. |
| **Three.js** (`three`) | `MIT` | [mrdoob/three.js](https://github.com/mrdoob/three.js) | WebGL 3D rendering engine. |
| **occt-import-js** (Open CASCADE Technology) | `LGPL-2.1` | [kovacsv/occt-import-js](https://github.com/kovacsv/occt-import-js) | STEP / IGES / BREP importer (self-hosted WASM; OCCT under LGPL-2.1 with OCCT exception). |
| **web-ifc** | `MPL-2.0` | [ThatOpen/engine_web-ifc](https://github.com/ThatOpen/engine_web-ifc) | IFC BIM model loader (self-hosted WASM). |
| **rhino3dm** | `MIT` | [mcneel/rhino3dm](https://github.com/mcneel/rhino3dm) | Rhino `.3dm` geometry loader (self-hosted WASM). |
| **Draco** (`draco3d`) | `Apache-2.0` | [google/draco](https://github.com/google/draco) | 3D mesh compression decoder. |
| **fflate** | `MIT` | [101arrowz/fflate](https://github.com/101arrowz/fflate) | Fast ZIP/deflate decompression. |
| **Fisherman's Bastion Envmap** (Emil Persson / Humus) | `CC-BY-3.0` | [creativecommons.org/licenses/by/3.0](https://creativecommons.org/licenses/by/3.0/) | Environment cubemap bundled with Online 3D Viewer (`http://www.humus.name`). |

---

## 5. Document Scanner, OCR, PDF & Media Viewers

| Component | License | Upstream Repository / Link | Notes |
| --- | --- | --- | --- |
| **jscanify** | `MIT` | [puffinsoft/jscanify](https://github.com/puffinsoft/jscanify) | Document corner detection and perspective warp. |
| **OpenCV.js** | `Apache-2.0` | [opencv/opencv](https://github.com/opencv/opencv) | Computer vision runtime for scanner edge detection/warping (self-hosted). |
| **ppu-paddle-ocr** | `MIT` | [PT-Perkasa-Pilar-Utama/ppu-paddle-ocr](https://github.com/PT-Perkasa-Pilar-Utama/ppu-paddle-ocr) | Browser PaddleOCR pipeline wrapper. |
| **PaddleOCR Models (PP-OCRv5 Korean)** | `Apache-2.0` | [PaddlePaddle/PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR) | Detection, Korean recognition ONNX models, and dictionary (packaged via [ppu-paddle-ocr-models](https://github.com/PT-Perkasa-Pilar-Utama/ppu-paddle-ocr-models)). |
| **ONNX Runtime Web** (`onnxruntime-web`) | `MIT` | [microsoft/onnxruntime](https://github.com/microsoft/onnxruntime) | Client-side WASM/WebGPU inference runtime for OCR. |
| **PDF.js** (`pdfjs-dist`) | `Apache-2.0` | [mozilla/pdf.js](https://github.com/mozilla/pdf.js) | PDF rasterization in Document Scanner and PDF-compatible `.ai` viewer. |
| **pdf-lib** & **@pdf-lib/fontkit** | `MIT` | [Hopding/pdf-lib](https://github.com/Hopding/pdf-lib) / [Hopding/fontkit](https://github.com/Hopding/fontkit) | Searchable OCR PDF assembly and font embedding. |
| **ag-psd** | `MIT` | [Agamnentzar/ag-psd](https://github.com/Agamnentzar/ag-psd) | Adobe Photoshop (`.psd`) file reader. |
| **marked** | `MIT` | [markedjs/marked](https://github.com/markedjs/marked) | Markdown parser. |
| **DOMPurify** | `MPL-2.0 OR Apache-2.0` | [cure53/DOMPurify](https://github.com/cure53/DOMPurify) | HTML sanitizer for Markdown rendering. |

---

## 6. Frontend Framework & Core Libraries

| Component | License | Upstream Repository / Link |
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

## 7. Embedded & Bundled Fonts

Sejong Office does **not** redistribute proprietary commercial fonts (such as Malgun Gothic, Batang, Dotum, Gulim, Calibri, Cambria, Consolas, or AutoCAD SHX fonts). Instead, it embeds open-source fonts and maps common document font names to metric- or style-compatible open-source replacements (see [`packages/desktop/src/koreanFontsPatch.cjs`](./packages/desktop/src/koreanFontsPatch.cjs) and [`packages/frontend/src/config/koreanFonts.ts`](./packages/frontend/src/config/koreanFonts.ts)).

### Korean Fonts

| Font Family | License | Upstream Source | Usage |
| --- | --- | --- | --- |
| **Nanum Fonts** (`NanumGothic`, `NanumBarunGothic`, `NanumSquare`, `NanumMyeongjo`) | `OFL-1.1` (SIL Open Font License 1.1) | [NAVER Nanum Font](https://hangeul.naver.com/font) / [naver/nanumfont](https://github.com/naver/nanumfont) | Embedded in the Desktop offline Office/RHWP bundle (Regular & Bold) and used as automatic fallbacks for common Korean document fonts (`맑은 고딕`, `바탕`, `돋움`, `굴림`, `궁서`, `함초롬바탕`, `함초롬돋움` 등). |
| **Pretendard** (`pretendard`) | `OFL-1.1` | [orioncactus/pretendard](https://github.com/orioncactus/pretendard) | Self-hosted primary UI typeface for Web and Desktop. |
| **Noto Sans KR** (`@noto-pdf-ts/fonts-kr`, `@fontsource-variable/noto-sans-kr`) | `OFL-1.1` | [notofonts/noto-cjk](https://github.com/notofonts/noto-cjk) | Self-hosted Korean fallback font for the MLightCAD viewer (`/viewer-assets/cad-resources/fonts/`). |

### Latin & Symbol Fonts (Desktop Offline Office Catalog)

The desktop offline OnlyOffice bundle (`packages/desktop/scripts/copy-web-dist.mjs`) includes core Latin and symbol fonts from the upstream OnlyOffice font catalog:

| Font Family | License | Upstream Source | Notes |
| --- | --- | --- | --- |
| **Carlito** | `OFL-1.1` | [googlefonts/carlito](https://github.com/googlefonts/carlito) | Metric-compatible open-source replacement for Calibri / Aptos / Segoe UI. |
| **Caladea** | `Apache-2.0` | [Google Fonts — Caladea](https://fonts.google.com/specimen/Caladea) | Metric-compatible open-source replacement for Cambria. |
| **Liberation Fonts** (`Liberation Sans`, `Liberation Serif`, `Liberation Mono`) | `OFL-1.1` | [liberationfonts/liberation-fonts](https://github.com/liberationfonts/liberation-fonts) | Metric-compatible open-source replacements for Arial, Times New Roman, and Consolas/Courier New. |
| **DejaVu Fonts** | `DejaVu / Bitstream Vera License` | [dejavu-fonts/dejavu-fonts](https://github.com/dejavu-fonts/dejavu-fonts) | Core multilingual/symbol coverage. |
| **Noto Sans** | `OFL-1.1` | [notofonts](https://github.com/notofonts/notofonts.github.io) | Core Unicode fallback font. |
| **OpenSymbol** | `MPL-2.0` / `LGPL-3.0-or-later` | [LibreOffice](https://www.libreoffice.org/) | Mathematical and bullet symbol font from upstream OnlyOffice core fonts. |

---

## 8. Trademark Notice

- **Microsoft**, **Office**, **Word**, **Excel**, **PowerPoint**, **Calibri**, **Cambria**, **Consolas**, and **Malgun Gothic** are trademarks or registered trademarks of Microsoft Corporation.
- **ONLYOFFICE** is a trademark of Ascensio System SIA.
- **한글**, **한컴**, **HWP**, and **HWPX** are registered trademarks of Hancom Inc. (주식회사 한글과컴퓨터).
- **AutoCAD** and **DWG** are trademarks of Autodesk, Inc.
- **Adobe**, **Photoshop**, and **Illustrator** are trademarks of Adobe Inc.

Sejong Office is an independent open-source project and is not affiliated with, sponsored by, or endorsed by any of the above trademark holders.
