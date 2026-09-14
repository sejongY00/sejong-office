import { ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  diagramKindFor,
  isHwp,
  isOffice,
  toolKindFor,
  viewerKindFor,
} from '@/config/app';
import {
  createBlankDocument,
  createSession,
  fetchDocumentContent,
  uploadDocument,
  type BlankDocumentType,
} from '@/api/client';
import {
  storeHwpBuffer,
  storeHwpFile,
} from '@/composables/useSessionLifecycle';
import { stageDiagramFile } from '@/composables/diagramSession';
import { stageImageEditFile } from '@/composables/imageEditSession';
import { stageScannerFiles } from '@/composables/scannerSession';
import { stageViewerFiles } from '@/composables/viewerSession';

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
    const file =
      files.find(
        (candidate) =>
          viewerKindFor(candidate.name) ||
          toolKindFor(candidate.name) ||
          diagramKindFor(candidate.name) ||
          isHwp(candidate.name) ||
          isOffice(candidate.name),
      ) ?? files[0];
    if (!file) return false;
    error.value = '';
    busy.value = true;

    try {
      const viewerKind = viewerKindFor(file.name);
      if (viewerKind) {
        stageViewerFiles(viewerKind, files);
        await router.push({ name: `${viewerKind}-viewer` });
        return true;
      }

      const toolKind = toolKindFor(file.name);
      if (toolKind === 'scanner') {
        const images = files.filter((candidate) => toolKindFor(candidate.name) === 'scanner');
        stageScannerFiles(images.length ? images : [file]);
        await router.push({ name: 'tools-scanner' });
        return true;
      }
      if (toolKind === 'imageedit') {
        stageImageEditFile(file);
        await router.push({ name: 'tools-image-edit' });
        return true;
      }

      const diagramKind = diagramKindFor(file.name);
      if (diagramKind) {
        stageDiagramFile(diagramKind, file);
        await router.push({ name: `${diagramKind}-editor` });
        return true;
      }

      if (isHwp(file.name)) {
        await storeHwpFile(file);
        await createSession().catch(() => undefined);
        await router.push({ name: 'rhwp-editor' });
        return true;
      }

      if (!isOffice(file.name)) {
        error.value =
          '지원하지 않는 형식입니다. 오피스, HWP, 다이어그램, CAD/3D 또는 이미지를 선택해 주세요.';
        return false;
      }

      await createSession();
      const { docId } = await uploadDocument(file);
      await router.push({ name: 'onlyoffice-editor', params: { docId } });
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
      await createSession();
      const doc = await createBlankDocument(type);

      if (type === 'hwpx') {
        const buffer = await fetchDocumentContent(doc.docId, doc.token);
        storeHwpBuffer(doc.filename, buffer);
        await router.push({ name: 'rhwp-editor' });
        return true;
      }

      await router.push({
        name: 'onlyoffice-editor',
        params: { docId: doc.docId },
      });
      return true;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : '새 문서를 만들 수 없습니다.';
      return false;
    } finally {
      busy.value = false;
    }
  }

  return { busy, error, openDocument, createAndOpenBlank };
}
