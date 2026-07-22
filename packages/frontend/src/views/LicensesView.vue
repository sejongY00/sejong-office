<script setup lang="ts">
import AppShell from '@/components/AppShell.vue';
import { APP_DISPLAY_NAME, APP_GIT_URL, APP_NAME } from '@/config/app';
import { usePageTitle } from '@/composables/usePageTitle';

usePageTitle('오픈소스 라이선스');

const thirdParty = [
  { name: 'Vue', license: 'MIT', url: 'https://github.com/vuejs/core' },
  { name: 'Vue Router', license: 'MIT', url: 'https://github.com/vuejs/router' },
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
    name: 'Noto Sans KR',
    license: 'SIL OFL 1.1',
    url: 'https://github.com/notofonts/noto-cjk',
  },
  { name: 'Express', license: 'MIT', url: 'https://github.com/expressjs/express' },
  { name: 'jsonwebtoken', license: 'MIT', url: 'https://github.com/auth0/node-jsonwebtoken' },
  { name: 'multer', license: 'MIT', url: 'https://github.com/expressjs/multer' },
  { name: 'uuid', license: 'MIT', url: 'https://github.com/uuidjs/uuid' },
];
</script>

<template>
  <AppShell>
    <main class="licenses">
      <header class="licenses__header">
        <RouterLink class="back" to="/">← 홈</RouterLink>
        <h1>오픈소스 라이선스 · 고지</h1>
        <p>
          {{ APP_DISPLAY_NAME }}({{ APP_NAME }})에 포함된 주요 소프트웨어의 라이선스와
          고지 사항입니다.
        </p>
      </header>

      <section class="card">
        <h2>본 앱</h2>
        <p>라이선스: <strong>GNU General Public License v3.0 only</strong></p>
        <p v-if="APP_GIT_URL">
          소스 코드:
          <a :href="APP_GIT_URL" target="_blank" rel="noopener noreferrer">{{
            APP_GIT_URL
          }}</a>
        </p>
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
            href="https://github.com/mlightcad/dxf-json"
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
        <h2>Euro-Office Document Server</h2>
        <p>
          <strong>GNU AGPL v3</strong>로 배포됩니다. 서버에 Document Server를
          배포·수정하는 경우 AGPL 의무(소스 제공 등)를 확인하세요.
        </p>
        <ul>
          <li>
            <a
              href="https://github.com/Euro-Office/DocumentServer"
              target="_blank"
              rel="noopener noreferrer"
              >Euro-Office DocumentServer (GitHub)</a
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
          Euro-Office Document Server는 ONLYOFFICE Document Server를 기반으로
          합니다. ONLYOFFICE는 Ascensio System SIA의 상표입니다. 본 프로젝트는
          Euro-Office·OnlyOffice와 공식 제휴 관계가 없습니다.
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
.licenses {
  flex: 1;
  width: min(720px, 100%);
  margin: 0 auto;
  padding: 2rem 1.25rem 3rem;
}

.licenses__header h1 {
  font-family: var(--font-display);
  font-size: 1.85rem;
  margin: 0.5rem 0 0.5rem;
}

.licenses__header p {
  color: var(--muted);
  margin: 0 0 1.5rem;
  line-height: 1.5;
}

.back {
  color: var(--accent);
  text-decoration: none;
  font-size: 0.9rem;
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
