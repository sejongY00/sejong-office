import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { diagramKindFor, isHwp, isOffice } from '@/config/app';
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

export function useOpenDocument() {
  const router = useRouter();
  const busy = ref(false);
  const error = ref('');

  async function openDocument(file: File | undefined): Promise<boolean> {
    if (!file || busy.value) return false;
    error.value = '';
    busy.value = true;

    try {
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
          '지원하지 않는 형식입니다. 오피스, HWP 또는 다이어그램 파일을 선택해 주세요.';
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
