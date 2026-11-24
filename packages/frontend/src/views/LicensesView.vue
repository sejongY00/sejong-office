<script setup lang="ts">
import { useRouter } from 'vue-router';
import AppShell from '@/components/AppShell.vue';
import DesktopWindowControls from '@/components/DesktopWindowControls.vue';
import { APP_DISPLAY_NAME, APP_GIT_URL, APP_NAME } from '@/config/app';
import { usePageTitle } from '@/composables/usePageTitle';

const router = useRouter();
usePageTitle('오픈소스 라이선스');

const repoBaseUrl = APP_GIT_URL.replace(/\/+$/, '');
const licenseFileUrl = repoBaseUrl ? `${repoBaseUrl}/blob/main/LICENSE` : '';
const thirdPartyNoticesUrl = repoBaseUrl
  ? `${repoBaseUrl}/blob/main/THIRD-PARTY-NOTICES.md`
  : '';

const thirdParty = [
  { name: 'Vue', license: 'MIT', url: 'https://github.com/vuejs/core' },
  { name: 'Vue Router', license: 'MIT', url: 'https://github.com/vuejs/router' },
  { name: 'VueUse', license: 'MIT', url: 'https://github.com/vueuse/vueuse' },
  { name: 'Vue I18n', license: 'MIT', url: 'https://github.com/intlify/vue-i18n' },
  {
    name: 'Element Plus',
    license: 'MIT',
    url: 'https://github.com/element-plus/element-plus',
  },
  { name: 'Vite', license: 'MIT', url: 'https://github.com/vitejs/vite' },
  { name: 'React', license: 'MIT', url: 'https://github.com/facebook/react' },
  {
    name: 'Excalidraw',
    license: 'MIT',
    url: 'https://github.com/excalidraw/excalidraw',
  },
  {
    name: 'Mermaid',
    license: 'MIT',
    url: 'https://github.com/mermaid-js/mermaid',
  },
  {
    name: 'marked',
    license: 'MIT',
    url: 'https://github.com/markedjs/marked',
  },
  {
    name: 'DOMPurify',
    license: 'MPL-2.0 OR Apache-2.0',
    url: 'https://github.com/cure53/DOMPurify',
  },
  {
    name: 'ag-psd',
    license: 'MIT',
    url: 'https://github.com/Agamnentzar/ag-psd',
  },
  { name: 'lodash-es', license: 'MIT', url: 'https://github.com/lodash/lodash' },
  { name: 'Three.js', license: 'MIT', url: 'https://github.com/mrdoob/three.js' },
  {
    name: 'Online 3D Viewer',
    license: 'MIT',
    url: 'https://github.com/kovacsv/Online3DViewer',
  },
  {
    name: 'occt-import-js',
    license: 'LGPL-2.1',
    url: 'https://github.com/kovacsv/occt-import-js',
  },
  {
    name: 'web-ifc',
    license: 'MPL-2.0',
    url: 'https://github.com/ThatOpen/engine_web-ifc',
  },
  {
    name: 'rhino3dm',
    license: 'MIT',
    url: 'https://github.com/mcneel/rhino3dm',
  },
  {
    name: 'Draco',
    license: 'Apache-2.0',
    url: 'https://github.com/google/draco',
  },
  {
    name: 'fflate',
    license: 'MIT',
    url: 'https://github.com/101arrowz/fflate',
  },
  {
    name: 'jscanify',
    license: 'MIT',
    url: 'https://github.com/puffinsoft/jscanify',
  },
  {
    name: 'OpenCV.js',
    license: 'Apache-2.0',
    url: 'https://github.com/opencv/opencv',
  },
  {
    name: 'ppu-paddle-ocr',
    license: 'MIT',
    url: 'https://github.com/PT-Perkasa-Pilar-Utama/ppu-paddle-ocr',
  },
  {
    name: 'ONNX Runtime Web',
    license: 'MIT',
    url: 'https://github.com/microsoft/onnxruntime',
  },
  {
    name: 'PaddleOCR models (PP-OCRv5)',
    license: 'Apache-2.0',
    url: 'https://github.com/PaddlePaddle/PaddleOCR',
  },
  {
    name: 'pdf-lib',
    license: 'MIT',
    url: 'https://github.com/Hopding/pdf-lib',
  },
  {
    name: '@pdf-lib/fontkit',
    license: 'MIT',
    url: 'https://github.com/Hopding/fontkit',
  },
  {
    name: 'PDF.js',
    license: 'Apache-2.0',
    url: 'https://github.com/mozilla/pdf.js',
  },
  {
    name: 'Electron',
    license: 'MIT',
    url: 'https://github.com/electron/electron',
  },
  {
    name: 'electron-updater / electron-builder',
    license: 'MIT',
    url: 'https://github.com/electron-userland/electron-builder',
  },
  {
    name: 'sharp (빌드 아이콘 생성)',
    license: 'Apache-2.0',
    url: 'https://github.com/lovell/sharp',
  },
  {
    name: 'Pretendard',
    license: 'SIL OFL 1.1',
    url: 'https://github.com/orioncactus/pretendard',
  },
  {
    name: 'Noto Sans KR / Noto Sans',
    license: 'SIL OFL 1.1',
    url: 'https://github.com/notofonts/noto-cjk',
  },
  {
    name: '나눔글꼴 (NanumGothic · NanumBarunGothic · NanumSquare · NanumMyeongjo)',
    license: 'SIL OFL 1.1',
    url: 'https://github.com/naver/nanumfont',
  },
  {
    name: 'Carlito',
    license: 'SIL OFL 1.1',
    url: 'https://github.com/googlefonts/carlito',
  },
  {
    name: 'Caladea',
    license: 'Apache-2.0',
    url: 'https://fonts.google.com/specimen/Caladea',
  },
  {
    name: 'Liberation Fonts',
    license: 'SIL OFL 1.1',
    url: 'https://github.com/liberationfonts/liberation-fonts',
  },
  {
    name: 'DejaVu Fonts',
    license: 'Bitstream Vera / DejaVu License',
    url: 'https://github.com/dejavu-fonts/dejavu-fonts',
  },
];
</script>

<template>
  <AppShell>
    <div class="licenses__topbar">
      <div class="licenses__top">
        <RouterLink class="back" to="/" title="홈으로 이동" aria-label="홈으로 이동">
          <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M10 3.5L5.5 8l4.5 4.5" />
          </svg>
        </RouterLink>
        <DesktopWindowControls
          :show-browser-close="false"
          @home="router.push({ name: 'home' })"
        />
      </div>
    </div>
    <main class="licenses">
      <header class="licenses__header">
        <h1>오픈소스 라이선스 · 고지</h1>
        <p>
          {{ APP_DISPLAY_NAME }}({{ APP_NAME }})에 포함된 주요 소프트웨어의 라이선스와
          고지 사항입니다.
        </p>
      </header>

      <section class="card">
        <h2>본 앱</h2>
        <p>라이선스: <strong>GNU General Public License v3.0 only</strong></p>
        <template v-if="APP_GIT_URL">
          <p>
            소스 코드:
            <a :href="APP_GIT_URL" target="_blank" rel="noopener noreferrer">{{
              APP_GIT_URL
            }}</a>
          </p>
          <p>
            문서:
            <a :href="licenseFileUrl" target="_blank" rel="noopener noreferrer"
              >LICENSE (GPL-3.0 전문)</a
            >
            ·
            <a
              :href="thirdPartyNoticesUrl"
              target="_blank"
              rel="noopener noreferrer"
              >THIRD-PARTY-NOTICES.md</a
            >
          </p>
        </template>
        <p v-else class="muted">
          소스 저장소 URL은 <code>APP_GIT_URL</code> 상수에 설정할 수 있습니다.
        </p>
        <p class="muted">
          본 앱의 UI는 Microsoft Office와 유사한 레이아웃을 참고했으나,
          Microsoft·Office·Word·Excel·PowerPoint 등 Microsoft 상표와 공식 제휴
          관계가 없습니다.
        </p>
      </section>

      <section class="card">
        <h2>MLightCAD · LibreDWG</h2>
        <p>
          CAD 화면과 렌더러는
          <a
            href="https://github.com/mlightcad/cad-viewer"
            target="_blank"
            rel="noopener noreferrer"
            >MLightCAD CAD Viewer</a
          >
          (MIT)를 사용합니다.
        </p>
        <p>
          DXF 변환기
          <a
            href="https://github.com/mlightcad/realdwg-web"
            target="_blank"
            rel="noopener noreferrer"
            >@mlightcad/dxf-json-converter</a
          >와 DWG Worker에 포함된
          <a
            href="https://www.gnu.org/software/libredwg/"
            target="_blank"
            rel="noopener noreferrer"
            >GNU LibreDWG</a
          >는 <strong>GPL-3.0</strong>입니다. 이에 따라 본 앱도
          GPL-3.0-only로 배포됩니다.
        </p>
        <p class="muted">
          상용 AutoCAD 폰트는 포함하지 않습니다. 누락된 한글·라틴 글꼴은 SIL Open
          Font License 1.1의 Noto Sans KR로 대체하며, 원본 글꼴과 글자 폭·형태가
          다를 수 있습니다.
        </p>
      </section>

      <section class="card">
        <h2>Online 3D Viewer</h2>
        <p>
          3D 뷰어 엔진은
          <a
            href="https://github.com/kovacsv/Online3DViewer"
            target="_blank"
            rel="noopener noreferrer"
            >Online 3D Viewer</a
          >
          (MIT)를 사용합니다. Three.js·fflate·Pickr(MIT), Draco(Apache-2.0),
          rhino3dm(MIT), web-ifc(MPL-2.0), occt-import-js(LGPL-2.1) 로더는
          CDN 없이 <code>/viewer-assets/o3dv/</code>에 자체 호스팅됩니다.
        </p>
        <p class="muted">
          CAD·3D 원본 파일과 보조 파일은 브라우저 메모리에서만 처리하며 앱 서버로
          업로드하거나 영구 저장하지 않습니다.
        </p>
      </section>

      <section class="card">
        <h2>문서 스캐너</h2>
        <p>
          문서 코너 검출·퍼스펙티브 보정은
          <a
            href="https://github.com/puffinsoft/jscanify"
            target="_blank"
            rel="noopener noreferrer"
            >jscanify</a
          >
          와 OpenCV.js(Apache-2.0)를 사용합니다. OCR은
          <a
            href="https://github.com/PT-Perkasa-Pilar-Utama/ppu-paddle-ocr"
            target="_blank"
            rel="noopener noreferrer"
            >ppu-paddle-ocr</a
          >
          (MIT)와 ONNX Runtime Web(MIT)으로 PP-OCRv5 한국어 모델을 브라우저에서
          실행하며, PDF 페이지 래스터화는
          <a
            href="https://github.com/mozilla/pdf.js"
            target="_blank"
            rel="noopener noreferrer"
            >PDF.js</a
          >
          (Apache-2.0), PDF 생성은 pdf-lib(MIT)입니다. OpenCV·ORT WASM·ONNX
          모델·사전·PDF.js worker는
          <code>/viewer-assets/scanner/</code>에 자체 호스팅됩니다.
        </p>
        <p class="muted">
          스캔 이미지와 OCR 결과는 브라우저에서만 처리하며 서버로 업로드하지
          않습니다. OCR을 켠 PDF에는 검색·복사용 투명 텍스트 레이어가
          포함됩니다.
        </p>
      </section>

      <section class="card">
        <h2>Document (ranuts/document) · ONLYOFFICE 편집기</h2>
        <p>
          오피스·PDF 편집은 브라우저 안에서만 동작하는
          <strong>ranuts/document</strong>(ONLYOFFICE 편집기 + x2t WebAssembly 개조판)를
          iframe으로 불러 씁니다. <strong>GNU AGPL v3</strong>이며, 파일은 브라우저에서만
          처리되고 어떤 서버로도 업로드되지 않습니다.
        </p>
        <ul>
          <li>
            <a
              href="https://github.com/ranuts/document"
              target="_blank"
              rel="noopener noreferrer"
              >ranuts/document (GitHub)</a
            >
          </li>
          <li>
            <a
              href="https://github.com/ONLYOFFICE/DocumentServer"
              target="_blank"
              rel="noopener noreferrer"
              >ONLYOFFICE DocumentServer (upstream)</a
            >
          </li>
        </ul>
        <p class="muted">
          ranuts/document는 ONLYOFFICE 공식 제품이 아닌 개조판입니다. ONLYOFFICE는 Ascensio
          System SIA의 상표입니다. 본 프로젝트는 ranuts·ONLYOFFICE와 공식 제휴 관계가 없습니다.
        </p>
      </section>

      <section class="card">
        <h2>diagrams.net / draw.io</h2>
        <p>
          라이선스: <strong>Apache License 2.0</strong> —
          <a
            href="https://github.com/jgraph/drawio"
            target="_blank"
            rel="noopener noreferrer"
            >github.com/jgraph/drawio</a
          >
        </p>
        <p class="muted">
          draw.io 편집 화면은 공식 <code>embed.diagrams.net</code> 정적 앱을
          네트워크로 불러옵니다. 다이어그램 데이터는 브라우저의
          <code>postMessage</code>를 통해 교환하며 본 앱 서버에 저장하지 않습니다.
        </p>
      </section>

      <section class="card">
        <h2>rhwp (@rhwp/editor, @rhwp/core)</h2>
        <p>라이선스: <strong>MIT</strong></p>
        <p>
          HWP/HWPX 뷰어·에디터 —
          <a
            href="https://github.com/edwardkim/rhwp"
            target="_blank"
            rel="noopener noreferrer"
            >github.com/edwardkim/rhwp</a
          >
        </p>
        <p class="muted">
          “한글”, “한컴”, “HWP”, “HWPX”는 주식회사 한글과컴퓨터의 등록 상표입니다.
          rhwp 및 본 앱은 한글과컴퓨터와 제휴·후원·승인 관계가 없는 독립 프로젝트입니다.
        </p>
      </section>

      <section class="card">
        <h2>데스크톱 앱 (Electron)</h2>
        <p>
          macOS·Windows 데스크톱 앱은
          <a
            href="https://github.com/electron/electron"
            target="_blank"
            rel="noopener noreferrer"
            >Electron</a
          >
          (MIT)과
          <a
            href="https://github.com/electron-userland/electron-builder"
            target="_blank"
            rel="noopener noreferrer"
            >electron-updater / electron-builder</a
          >
          (MIT)를 사용하며, 패키징 시 아이콘 변환에는
          <a
            href="https://github.com/lovell/sharp"
            target="_blank"
            rel="noopener noreferrer"
            >sharp</a
          >
          (Apache-2.0)를 사용합니다.
        </p>
        <p class="muted">
          데스크톱 배포판은 오프라인 실행을 위해 <strong>ranuts/document</strong>
          (ONLYOFFICE, AGPL-3.0)와 <strong>rhwp</strong> (MIT) 런타임을 로컬에
          번들하며, 문서 데이터는 외부 서버로 전송하지 않습니다.
        </p>
      </section>

      <section class="card">
        <h2>내장 글꼴 (한국어 · 영문)</h2>
        <p>
          UI 기본 글꼴은
          <a
            href="https://github.com/orioncactus/pretendard"
            target="_blank"
            rel="noopener noreferrer"
            >Pretendard</a
          >
          (SIL OFL 1.1), CAD 한글 폴백 글꼴은
          <a
            href="https://github.com/notofonts/noto-cjk"
            target="_blank"
            rel="noopener noreferrer"
            >Noto Sans KR</a
          >
          (SIL OFL 1.1)을 자체 호스팅합니다.
        </p>
        <p>
          데스크톱 오피스·HWP 편집기에는 네이버
          <a
            href="https://github.com/naver/nanumfont"
            target="_blank"
            rel="noopener noreferrer"
            >나눔글꼴</a
          >
          (<strong>나눔고딕 · 나눔바른고딕 · 나눔스퀘어 · 나눔명조</strong>,
          SIL OFL 1.1)이 내장되어 있으며, 영문·기호 호환을 위해
          <a
            href="https://github.com/googlefonts/carlito"
            target="_blank"
            rel="noopener noreferrer"
            >Carlito</a
          >
          (SIL OFL 1.1),
          <a
            href="https://fonts.google.com/specimen/Caladea"
            target="_blank"
            rel="noopener noreferrer"
            >Caladea</a
          >
          (Apache-2.0),
          <a
            href="https://github.com/liberationfonts/liberation-fonts"
            target="_blank"
            rel="noopener noreferrer"
            >Liberation Fonts</a
          >
          (SIL OFL 1.1),
          <a
            href="https://github.com/dejavu-fonts/dejavu-fonts"
            target="_blank"
            rel="noopener noreferrer"
            >DejaVu Fonts</a
          >,
          <a
            href="https://github.com/notofonts/notofonts.github.io"
            target="_blank"
            rel="noopener noreferrer"
            >Noto Sans</a
          >
          (SIL OFL 1.1)가 포함됩니다.
        </p>
        <p class="muted">
          맑은 고딕·바탕·돋움·굴림·궁서·함초롬·Calibri·Cambria·Consolas 등
          상용 글꼴 파일은 포함하지 않으며, 해당 글꼴명이 지정된 문서는
          내장 오픈소스 글꼴로 자동 매핑하여 표시합니다.
        </p>
      </section>

      <section class="card">
        <h2>기타 주요 의존성</h2>
        <ul class="deps">
          <li v-for="item in thirdParty" :key="item.name">
            <a :href="item.url" target="_blank" rel="noopener noreferrer">{{
              item.name
            }}</a>
            — {{ item.license }}
          </li>
        </ul>
      </section>
    </main>
  </AppShell>
</template>

<style scoped>
.licenses__topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  width: 100%;
  min-height: 40px;
  padding: 0.35rem 0.75rem;
  background: color-mix(in srgb, var(--canvas) 92%, transparent);
  backdrop-filter: blur(8px);
  user-select: none;
  -webkit-app-region: drag;
}

.licenses {
  flex: 1;
  width: min(720px, 100%);
  margin: 0 auto;
  padding: 0.5rem 1.25rem 3rem;
}

.licenses__header h1 {
  font-family: var(--font-display);
  font-size: 1.85rem;
  margin: 0.25rem 0 0.5rem;
}

.licenses__header p {
  color: var(--muted);
  margin: 0 0 1.5rem;
  line-height: 1.5;
}

.licenses__top {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.back {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 26px;
  border-radius: 4px;
  color: var(--ink);
  opacity: 0.82;
  text-decoration: none;
  transition: background-color 0.12s ease, opacity 0.12s ease;
  -webkit-app-region: no-drag;
}

.back:hover {
  opacity: 1;
  background: color-mix(in srgb, var(--ink) 8%, transparent);
}

.card {
  padding: 1.25rem 0;
  border-top: 1px solid var(--border);
}

.card h2 {
  font-size: 1.1rem;
  margin: 0 0 0.65rem;
}

.card p,
.card li {
  font-size: 0.92rem;
  line-height: 1.55;
  color: var(--ink-soft);
}

.card a {
  color: var(--accent);
}

.muted {
  color: var(--muted) !important;
  font-size: 0.85rem !important;
}

.deps {
  padding-left: 1.1rem;
  margin: 0;
}

code {
  font-size: 0.85em;
  background: var(--accent-soft);
  padding: 0.1em 0.35em;
  border-radius: 3px;
}
</style>
