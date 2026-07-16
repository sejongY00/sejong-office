export function downloadBlob(
  data: Blob | ArrayBuffer | Uint8Array,
  filename: string,
) {
  const blob =
    data instanceof Blob
      ? data
      : new Blob([data instanceof Uint8Array ? data.slice() : data]);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
