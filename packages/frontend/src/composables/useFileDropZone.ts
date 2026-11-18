import { ref } from 'vue';
import { filesFromDrop } from '@/utils/fileAccess';

/** Nested dragenter/leave safe file drop handlers for a page root. */
export function useFileDropZone(onFiles: (files: File[]) => void) {
  const dropActive = ref(false);
  let depth = 0;

  function onDragEnter(event: DragEvent) {
    event.preventDefault();
    depth += 1;
    dropActive.value = true;
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  }

  function onDragOver(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  }

  function onDragLeave(event: DragEvent) {
    event.preventDefault();
    depth = Math.max(0, depth - 1);
    if (depth === 0) dropActive.value = false;
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    depth = 0;
    dropActive.value = false;
    void filesFromDrop(event).then((files) => {
      if (files.length) onFiles(files);
    });
  }

  return {
    dropActive,
    onDragEnter,
    onDragOver,
    onDragLeave,
    onDrop,
  };
}
