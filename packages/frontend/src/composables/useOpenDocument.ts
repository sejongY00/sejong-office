import { ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  diagramKindFor,
  isHwp,
  isOffice,
  toolKindFor,
  viewerKindFor,
} from '@/config/app';
import { fetchBlankTemplate, type BlankDocumentType } from '@/utils/appError';
import { officeOpenToken, stageOfficeBuffer, stageOfficeFile } from '@/composables/officeSession';
import {
  storeHwpBuffer,
  storeHwpFile,
} from '@/composables/useSessionLifecycle';
import { stageDiagramFile } from '@/composables/diagramSession';
import { stageImageEditFile } from '@/composables/imageEditSession';
import {
  recordRecentFile,
  resolveRecentFile,
  type RecentFileEntry,
} from '@/composables/useRecentFiles';
import { stageScannerFiles } from '@/composables/scannerSession';
import { stageViewerFiles } from '@/composables/viewerSession';
import { createDesktopFileHandle } from '@/pwa/fileLaunch';
import { bindFileHandle, handleOf } from '@/utils/fileAccess';

export function useOpenDocument() {
  const router = useRouter();
  const busy = ref(false);
  const error = ref('');

  async function openDocument(
    input: File | FileList | readonly File[] | undefined,
  ): Promise<boolean> {
    if (!input || busy.value) return false;
    const files =
      input instanceof File
        ? [input]
        : Array.from(input);
    const isDesktop = Boolean(window.sejongDesktop);
    const file =
      files.find((candidate) =>
        isDesktop
          ? isHwp(candidate.name) || isOffice(candidate.name)
          : viewerKindFor(candidate.name) ||
            toolKindFor(candidate.name) ||
            diagramKindFor(candidate.name) ||
            isHwp(candidate.name) ||
            isOffice(candidate.name),
      ) ?? files[0];
    if (!file) return false;
    if (!handleOf(file) && window.sejongDesktop?.getFilePath) {
      const desktopPath = window.sejongDesktop.getFilePath(file);
      if (desktopPath) {
        bindFileHandle(file, createDesktopFileHandle(window.sejongDesktop, desktopPath));
      }
    }
    error.value = '';
    busy.value = true;

    try {
      if (!isDesktop) {
        const viewerKind = viewerKindFor(file.name);
        if (viewerKind) {
          recordRecentFile({ name: file.name, file, handle: handleOf(file) });
          stageViewerFiles(viewerKind, files);
          await router.push({ name: `${viewerKind}-viewer` });
          return true;
        }

        const toolKind = toolKindFor(file.name);
        if (toolKind === 'scanner') {
          const images = files.filter((candidate) => toolKindFor(candidate.name) === 'scanner');
          recordRecentFile({ name: file.name, file, handle: handleOf(file) });
          stageScannerFiles(images.length ? images : [file]);
          await router.push({ name: 'tools-scanner' });
          return true;
        }
        if (toolKind === 'imageedit') {
          recordRecentFile({ name: file.name, file, handle: handleOf(file) });
          stageImageEditFile(file);
          await router.push({ name: 'tools-image-edit' });
          return true;
        }

        const diagramKind = diagramKindFor(file.name);
        if (diagramKind) {
          recordRecentFile({ name: file.name, file, handle: handleOf(file) });
          stageDiagramFile(diagramKind, file);
          await router.push({ name: `${diagramKind}-editor` });
          return true;
        }
      }

      if (isHwp(file.name)) {
        recordRecentFile({ name: file.name, file, handle: handleOf(file) });
        await storeHwpFile(file);
        await router.push({ name: 'rhwp-editor' });
        return true;
      }

      if (!isOffice(file.name)) {
        error.value = isDesktop
          ? '데스크톱 앱은 오피스(Word·Excel·PPT·PDF·CSV)와 한글(HWP·HWPX) 문서만 지원합니다. 다이어그램·뷰어·도구는 온라인(office.sejong.dev)에서 이용해 주세요.'
          : '지원하지 않는 형식입니다. 오피스, HWP, 다이어그램, CAD/3D 또는 이미지를 선택해 주세요.';
        return false;
      }

      recordRecentFile({ name: file.name, file, handle: handleOf(file) });
      await stageOfficeFile(file);
      await router.push({ name: 'office-editor', query: { d: String(officeOpenToken()) } });
      return true;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : '파일을 열 수 없습니다.';
      return false;
    } finally {
      busy.value = false;
    }
  }

  async function createAndOpenBlank(type: BlankDocumentType): Promise<boolean> {
    if (busy.value) return false;
    error.value = '';
    busy.value = true;

    try {
      const buffer = await fetchBlankTemplate(type);
      const name = `새문서.${type}`;

      if (type === 'hwpx') {
        storeHwpBuffer(name, buffer);
        await router.push({ name: 'rhwp-editor' });
        return true;
      }

      stageOfficeBuffer(name, buffer);
      await router.push({ name: 'office-editor', query: { d: String(officeOpenToken()) } });
      return true;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : '새 문서를 만들 수 없습니다.';
      return false;
    } finally {
      busy.value = false;
    }
  }

  async function openRecentDocument(entry: RecentFileEntry): Promise<boolean> {
    if (busy.value) return false;
    error.value = '';
    try {
      const file = await resolveRecentFile(entry);
      return await openDocument(file);
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : '최근 파일을 열 수 없습니다.';
      return false;
    }
  }

  return { busy, error, openDocument, openRecentDocument, createAndOpenBlank };
}
