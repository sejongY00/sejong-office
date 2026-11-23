<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import AppShell from '@/components/AppShell.vue';
import DesktopWindowControls from '@/components/DesktopWindowControls.vue';
import FileTypeIcon from '@/components/FileTypeIcon.vue';
import { APP_DISPLAY_NAME, APP_WEB_URL, extensionOf } from '@/config/app';
import { useDesktopUpdate } from '@/composables/useDesktopUpdate';
import { useOpenDocument } from '@/composables/useOpenDocument';
import { usePageTitle } from '@/composables/usePageTitle';
import { useRecentFiles, type RecentFileEntry } from '@/composables/useRecentFiles';
import type { BlankDocumentType } from '@/utils/appError';
import { filesFromDrop, pickFiles } from '@/utils/fileAccess';

const dragging = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
const router = useRouter();
const { busy, error, openDocument, openRecentDocument, createAndOpenBlank } = useOpenDocument();
const {
  recentFiles,
  recentFilesDisabled,
  removeRecentFile,
  clearRecentFiles,
  setRecentFilesDisabled,
} = useRecentFiles();
const { isChecking: checkingUpdate, checkForUpdates } = useDesktopUpdate();
const isDesktop = Boolean(window.sejongDesktop);
const logoUrl = '/icons/icon.svg';

const DESKTOP_ACCEPT =
  '.docx,.xlsx,.pptx,.pdf,.hwp,.hwpx,.odt,.ods,.odp,.doc,.xls,.ppt,.rtf,.txt,.csv,.dotx,.xltx,.potx';
const WEB_ACCEPT =
  '.docx,.xlsx,.pptx,.pdf,.hwp,.hwpx,.odt,.ods,.odp,.doc,.xls,.ppt,.rtf,.txt,.csv,.excalidraw,.mmd,.mermaid,.drawio,.xml,.dxf,.dwg,.ai,.psd,.md,.markdown,.3dm,.3ds,.3mf,.amf,.bim,.brp,.brep,.dae,.fbx,.fcstd,.gltf,.glb,.ifc,.igs,.iges,.stp,.step,.stl,.obj,.off,.ply,.wrl,.zip,.bin,.mtl,.png,.jpg,.jpeg,.webp,.ico';

usePageTitle();

const blankTypes: {
  type: BlankDocumentType;
  title: string;
  subtitle: string;
}[] = [
  { type: 'docx', title: '문서 (DOCX)', subtitle: '새문서.docx' },
  { type: 'xlsx', title: '스프레드시트 (XLSX)', subtitle: '새문서.xlsx' },
  { type: 'pptx', title: '프레젠테이션 (PPTX)', subtitle: '새문서.pptx' },
  { type: 'hwpx', title: '한글 문서 (HWPX)', subtitle: '새문서.hwpx' },
];

const diagramTypes = [
  {
    route: 'excalidraw-editor',
    extension: 'excalidraw',
    title: '스케치 (Excalidraw)',
    subtitle: '새그림.excalidraw',
  },
  {
    route: 'mermaid-editor',
    extension: 'mmd',
    title: '텍스트 다이어그램 (Mermaid)',
    subtitle: '새다이어그램.mmd',
  },
  {
    route: 'drawio-editor',
    extension: 'drawio',
    title: '다이어그램 (draw.io)',
    subtitle: '새다이어그램.drawio',
  },
] as const;

const viewerTypes = [
  {
    route: 'cad-viewer',
    extension: 'dwg',
    title: 'CAD 도면',
    subtitle: 'DXF · DWG',
  },
  {
    route: 'model3d-viewer',
    extension: 'glb',
    title: '3D 모델',
    subtitle: 'glTF · OBJ · STEP · IFC · STL · 3DM 등',
  },
  {
    route: 'illustrator-viewer',
    extension: 'ai',
    title: '일러스트',
    subtitle: 'Adobe Illustrator (.ai, PDF 호환)',
  },
  {
    route: 'photoshop-viewer',
    extension: 'psd',
    title: '포토샵',
    subtitle: 'Adobe Photoshop (.psd, RGB 8bit)',
  },
  {
    route: 'markdown-viewer',
    extension: 'md',
    title: '마크다운',
    subtitle: '.md · 입력 미리보기',
  },
] as const;

const toolTypes = [
  {
    route: 'tools-scanner',
    extension: 'png',
    title: '문서 스캐너',
    subtitle: '코너 보정 · OCR · PDF',
  },
  {
    route: 'tools-bg-remove',
    extension: 'bgremove',
    title: '배경 제거',
    subtitle: '로고 단색 배경 · 투명 PNG',
  },
  {
    route: 'tools-image-edit',
    extension: 'imgedit',
    title: '이미지 편집',
    subtitle: '크롭 · 축소 · 경량화 · 비율',
  },
] as const;

function onDrop(e: DragEvent) {
  dragging.value = false;
  void filesFromDrop(e).then(openDocument);
}

// The drop zone is a <label>; take over its click so the native picker (with save-in-place) opens.
function onPick(e: MouseEvent) {
  if (busy.value || !('showOpenFilePicker' in window)) return;
  e.preventDefault();
  void pickFiles(fileInput.value, openDocument);
}

function onInput(e: Event) {
  const input = e.target as HTMLInputElement;
  void openDocument(input.files ?? undefined);
  input.value = '';
}

function onCreate(type: BlankDocumentType) {
  void createAndOpenBlank(type);
}

function onOpenTool(route: string) {
  void router.push({ name: route });
}

function onOpenRecent(entry: RecentFileEntry) {
  void openRecentDocument(entry);
}

function onRemoveRecent(id: string) {
  removeRecentFile(id);
}

function onClearRecent() {
  clearRecentFiles();
}

function onToggleRecentDisabled() {
  setRecentFilesDisabled(!recentFilesDisabled.value);
}

function formatRecentMeta(entry: RecentFileEntry): string {
  const d = new Date(entry.openedAt);
  const pad = (n: number) => String(n).padStart(2, '0');
  const timeStr = `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return entry.path ? `${entry.path} · ${timeStr}` : timeStr;
}
</script>

<template>
  <AppShell>
    <header class="home__topbar">
      <div class="home__actions">
        <button
          v-if="isDesktop"
          type="button"
          class="home__icon-btn"
          :class="{ 'home__icon-btn--spin': checkingUpdate }"
          :disabled="checkingUpdate"
          title="업데이트 확인"
          aria-label="업데이트 확인"
          @click="checkForUpdates"
        >
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M13.5 8a5.5 5.5 0 1 1-1.4-3.65" />
            <path d="M13.5 2.5v2.75h-2.75" />
          </svg>
        </button>
        <RouterLink
          class="home__icon-btn"
          to="/licenses"
          title="오픈소스 라이선스"
          aria-label="라이선스"
        >
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="8" cy="8" r="6" />
            <path d="M8 7.2v3.6M8 4.9h.01" />
          </svg>
        </RouterLink>
        <DesktopWindowControls :show-home="false" :show-browser-close="false" />
      </div>
    </header>
    <main class="home">
      <div class="home__top">
        <div class="home__brand-wrap">
          <img
            class="home__logo"
            :src="logoUrl"
            alt=""
            width="34"
            height="34"
            draggable="false"
          />
          <h1 class="home__brand">{{ APP_DISPLAY_NAME }}</h1>
        </div>
      </div>

      <section class="section">
        <h2 class="section__title">파일 열기</h2>
        <p class="section__lead">
          {{
            isDesktop
              ? '모든 문서는 오프라인으로 내 컴퓨터 안에서만 열리고 편집 후 저장하면 원본 파일에 그대로 덮어씁니다.'
              : '파일은 브라우저 안에서만 열리고 어디에도 업로드되지 않습니다. 편집 후 저장하면 연 파일에 그대로 덮어씁니다(크롬·엣지 PC). 그 외 브라우저에서는 다운로드됩니다.'
          }}
        </p>

        <label
          class="drop"
          :class="{ 'drop--active': dragging, 'drop--busy': busy }"
          @dragenter.prevent="dragging = true"
          @dragover.prevent="dragging = true"
          @dragleave.prevent="dragging = false"
          @drop.prevent="onDrop"
          @click="onPick"
        >
          <input
            ref="fileInput"
            class="drop__input"
            type="file"
            :accept="isDesktop ? DESKTOP_ACCEPT : WEB_ACCEPT"
            multiple
            :disabled="busy"
            @change="onInput"
          />
          <span class="drop__label">
            {{ busy ? '여는 중…' : '파일을 끌어다 놓거나 클릭하여 선택' }}
          </span>
          <span class="drop__hint">
            {{
              isDesktop
                ? '오피스 문서 (Word · Excel · PowerPoint · PDF · CSV) · 한글 문서 (HWP · HWPX)'
                : '오피스·PDF · HWP/HWPX · 다이어그램 · CAD · 3D · 일러스트(.ai) · 포토샵(.psd) · 마크다운(.md) · 이미지(스캐너) · 아이콘(.ico)'
            }}
          </span>
        </label>

        <p v-if="error" class="home__error" role="alert">{{ error }}</p>
      </section>

      <section class="section">
        <h2 class="section__title">새 문서</h2>
        <p class="section__lead">빈 문서를 만들어 바로 편집합니다.</p>

        <div class="grid">
          <button
            v-for="item in blankTypes"
            :key="item.type"
            type="button"
            class="tile"
            :disabled="busy"
            @click="onCreate(item.type)"
          >
            <FileTypeIcon :extension="item.type" :size="36" />
            <span class="tile__text">
              <strong>{{ item.title }}</strong>
              <span>{{ item.subtitle }}</span>
            </span>
          </button>
        </div>
      </section>

      <section v-if="isDesktop" class="section recent-section" aria-label="최근 파일">
        <div class="recent-section__header">
          <h2 class="section__title recent-section__title">최근 파일</h2>
          <div class="recent-section__actions">
            <button
              v-if="!recentFilesDisabled && recentFiles.length > 0"
              type="button"
              class="recent-action-btn"
              @click="onClearRecent"
            >
              목록 전체 삭제
            </button>
            <button
              type="button"
              class="recent-action-btn"
              :aria-pressed="recentFilesDisabled"
              @click="onToggleRecentDisabled"
            >
              {{ recentFilesDisabled ? '최근 파일 목록 사용' : '최근 파일 목록 사용 안 함' }}
            </button>
          </div>
        </div>

        <p v-if="recentFilesDisabled" class="recent-empty">
          최근 파일 목록 기능이 사용 안 함으로 설정되어 있습니다.
        </p>
        <p v-else-if="recentFiles.length === 0" class="recent-empty">
          최근에 열거나 저장한 문서가 없습니다. (최대 5개까지 표시)
        </p>
        <ul v-else class="recent-list">
          <li
            v-for="item in recentFiles"
            :key="item.id"
            class="recent-item"
          >
            <button
              type="button"
              class="recent-item__open"
              :disabled="busy"
              :title="item.path || item.name"
              @click="onOpenRecent(item)"
            >
              <FileTypeIcon :extension="extensionOf(item.name)" :size="30" />
              <span class="recent-item__text">
                <strong>{{ item.name }}</strong>
                <span>{{ formatRecentMeta(item) }}</span>
              </span>
            </button>
            <button
              type="button"
              class="recent-item__remove"
              title="목록에서 삭제"
              :aria-label="`${item.name} 최근 목록에서 삭제`"
              @click="onRemoveRecent(item.id)"
            >
              <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true">
                <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
              </svg>
            </button>
          </li>
        </ul>
      </section>

      <section v-if="isDesktop" class="desktop-web-notice" aria-label="웹 버전 안내">
        <p class="desktop-web-notice__text">
          다이어그램(Excalidraw · Mermaid · draw.io), 뷰어(CAD · 3D · 일러스트 · 포토샵 · 마크다운), 스캐너·이미지 도구는 온라인 웹 버전에서 이용할 수 있습니다.
          <a
            class="desktop-web-notice__link"
            :href="APP_WEB_URL"
            target="_blank"
            rel="noopener noreferrer"
          >
            office.sejong.dev 접속 ↗
          </a>
        </p>
      </section>

      <section v-if="!isDesktop" class="section">
        <h2 class="section__title">다이어그램</h2>
        <p class="section__lead">
          브라우저에서 직접 편집하고 원본·SVG·PNG로 저장합니다.
        </p>

        <div class="grid">
          <button
            v-for="item in diagramTypes"
            :key="item.route"
            type="button"
            class="tile"
            :disabled="busy"
            @click="onOpenTool(item.route)"
          >
            <FileTypeIcon :extension="item.extension" :size="36" />
            <span class="tile__text">
              <strong>{{ item.title }}</strong>
              <span>{{ item.subtitle }}</span>
            </span>
          </button>
        </div>
      </section>

      <section v-if="!isDesktop" class="section">
        <h2 class="section__title">뷰어</h2>
        <p class="section__lead">
          서버 업로드 없이 도면·모델·일러스트·포토샵·마크다운을 조회합니다. 텍스처·MTL·BIN
          등 보조 파일이나 ZIP은 원본과 함께 선택하세요. .ai는 PDF 호환, .psd는
          RGB·8bit만 안정적으로 열립니다.
        </p>

        <div class="grid">
          <button
            v-for="item in viewerTypes"
            :key="item.route"
            type="button"
            class="tile"
            :disabled="busy"
            @click="onOpenTool(item.route)"
          >
            <FileTypeIcon :extension="item.extension" :size="36" />
            <span class="tile__text">
              <strong>{{ item.title }}</strong>
              <span>{{ item.subtitle }}</span>
            </span>
          </button>
        </div>
      </section>

      <section v-if="!isDesktop" class="section">
        <h2 class="section__title">도구</h2>
        <p class="section__lead">
          브라우저에서 문서를 스캔하고, 배경을 제거하며, 이미지를 크롭·축소·경량화합니다.
        </p>

        <div class="grid">
          <button
            v-for="item in toolTypes"
            :key="item.route"
            type="button"
            class="tile"
            :disabled="busy"
            @click="onOpenTool(item.route)"
          >
            <FileTypeIcon :extension="item.extension" :size="36" />
            <span class="tile__text">
              <strong>{{ item.title }}</strong>
              <span>{{ item.subtitle }}</span>
            </span>
          </button>
        </div>
      </section>
    </main>
  </AppShell>
</template>

<style scoped>
.home__topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  width: 100%;
  min-height: 40px;
  padding: 0.35rem 0.75rem;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  background: color-mix(in srgb, var(--canvas) 92%, transparent);
  backdrop-filter: blur(8px);
  user-select: none;
  -webkit-app-region: drag;
}

.home {
  flex: 1;
  width: min(920px, 100%);
  margin: 0 auto;
  padding: 0.25rem 1.25rem 3rem;
}

.home__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.home__actions {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-left: auto;
  -webkit-app-region: no-drag;
}

.home__brand-wrap {
  display: inline-flex;
  align-items: center;
  gap: 0.65rem;
}

.home__logo {
  display: block;
  width: 34px;
  height: 34px;
  border-radius: 8px;
  flex-shrink: 0;
}

.home__brand {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.5rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--ink);
}

.home__icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 26px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--ink);
  opacity: 0.78;
  cursor: pointer;
  text-decoration: none;
  transition: background-color 0.12s ease, opacity 0.12s ease;
  -webkit-app-region: no-drag;
}

.home__icon-btn:hover {
  opacity: 1;
  background: color-mix(in srgb, var(--ink) 8%, transparent);
}

.home__icon-btn--spin svg {
  animation: home-spin 0.9s linear infinite;
}

@keyframes home-spin {
  to {
    transform: rotate(360deg);
  }
}

.section {
  margin-bottom: 2rem;
}

.section__title {
  margin: 0 0 0.35rem;
  font-size: 1.15rem;
  font-weight: 600;
  color: var(--ink);
}

.section__lead {
  margin: 0 0 1rem;
  font-size: 0.9rem;
  color: var(--muted);
}

.drop {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  min-height: 7.5rem;
  padding: 1.5rem 1.25rem;
  border: 1.5px dashed var(--border);
  border-radius: 8px;
  background: var(--card);
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    background 0.2s ease;
}

.drop:hover,
.drop--active {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.drop--busy {
  opacity: 0.7;
  pointer-events: none;
}

.drop__input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  overflow: hidden;
}

.drop__label {
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--ink);
}

.drop__hint {
  font-size: 0.8rem;
  color: var(--muted);
}

.home__error {
  margin: 0.85rem 0 0;
  color: var(--danger);
  font-size: 0.9rem;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 0.75rem;
}

.tile {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 0.9rem 1rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--card);
  text-align: left;
  cursor: pointer;
  font-family: inherit;
  color: var(--ink);
  transition:
    background 0.15s ease,
    border-color 0.15s ease;
}

.tile :deep(.ft-icon) {
  width: 36px;
  height: 36px;
}

.tile:hover:not(:disabled) {
  background: var(--card-hover);
  border-color: color-mix(in srgb, var(--accent) 40%, var(--border));
}

.tile:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.tile__text {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}

.tile__text strong {
  font-size: 0.92rem;
  font-weight: 600;
}

.tile__text span {
  font-size: 0.78rem;
  color: var(--muted);
}

.recent-section__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.recent-section__title {
  margin: 0;
}

.recent-section__actions {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.recent-action-btn {
  padding: 0.25rem 0.55rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: transparent;
  color: var(--muted);
  font-family: inherit;
  font-size: 0.76rem;
  cursor: pointer;
  transition:
    color 0.15s ease,
    border-color 0.15s ease,
    background-color 0.15s ease;
}

.recent-action-btn:hover {
  color: var(--ink);
  border-color: color-mix(in srgb, var(--ink) 25%, var(--border));
  background: color-mix(in srgb, var(--ink) 5%, transparent);
}

.recent-empty {
  margin: 0;
  padding: 0.85rem 1rem;
  border: 1px dashed var(--border);
  border-radius: 8px;
  font-size: 0.83rem;
  color: var(--muted);
  background: color-mix(in srgb, var(--card) 55%, transparent);
}

.recent-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.recent-item {
  display: flex;
  align-items: center;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--card);
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease;
}

.recent-item:hover {
  background: var(--card-hover);
  border-color: color-mix(in srgb, var(--accent) 40%, var(--border));
}

.recent-item__open {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.65rem 0.85rem;
  border: 0;
  background: transparent;
  color: var(--ink);
  font-family: inherit;
  text-align: left;
  cursor: pointer;
}

.recent-item__open:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.recent-item__open :deep(.ft-icon) {
  width: 30px;
  height: 30px;
  flex-shrink: 0;
}

.recent-item__text {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
}

.recent-item__text strong {
  font-size: 0.88rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.recent-item__text span {
  font-size: 0.75rem;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.recent-item__remove {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  margin-right: 0.45rem;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  transition:
    color 0.15s ease,
    background-color 0.15s ease;
}

.recent-item__remove:hover {
  color: var(--danger);
  background: color-mix(in srgb, var(--danger) 10%, transparent);
}

.desktop-web-notice {
  margin-top: 2.25rem;
  padding-top: 1.1rem;
  border-top: 1px solid color-mix(in srgb, var(--border) 65%, transparent);
}

.desktop-web-notice__text {
  margin: 0;
  font-size: 0.82rem;
  line-height: 1.55;
  color: var(--muted);
}

.desktop-web-notice__link {
  display: inline-block;
  margin-left: 0.35rem;
  color: var(--ink);
  opacity: 0.78;
  text-decoration: underline;
  text-underline-offset: 3px;
  text-decoration-color: color-mix(in srgb, var(--muted) 55%, transparent);
  transition: opacity 0.15s ease, color 0.15s ease;
}

.desktop-web-notice__link:hover {
  opacity: 1;
  color: var(--accent);
}
</style>
