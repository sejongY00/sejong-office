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
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function downloadText(
  text: string,
  filename: string,
  type = 'text/plain;charset=utf-8',
) {
  downloadBlob(new Blob([text], { type }), filename);
}

export async function readTextFile(
  file: File,
  maxBytes = 20 * 1024 * 1024,
): Promise<string> {
  if (file.size > maxBytes) {
    throw new Error('파일이 너무 큽니다. 20MB 이하의 파일을 선택해 주세요.');
  }
  return file.text();
}

export function dataUriToBlob(dataUri: string): Blob {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUri);
  if (!match) {
    throw new Error('내보내기 데이터 형식이 올바르지 않습니다.');
  }

  const mime = match[1] || 'application/octet-stream';
  const encoded = match[3];
  if (match[2]) {
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mime });
  }
  return new Blob([decodeURIComponent(encoded)], { type: mime });
}

function svgDimensions(svg: string): { width: number; height: number } {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const root = doc.documentElement;
  const viewBox = root.getAttribute('viewBox')?.trim().split(/\s+/).map(Number);
  if (viewBox?.length === 4 && viewBox.every(Number.isFinite)) {
    return {
      width: Math.max(1, viewBox[2]),
      height: Math.max(1, viewBox[3]),
    };
  }

  const width = Number.parseFloat(root.getAttribute('width') ?? '');
  const height = Number.parseFloat(root.getAttribute('height') ?? '');
  return {
    width: Number.isFinite(width) && width > 0 ? width : 1200,
    height: Number.isFinite(height) && height > 0 ? height : 800,
  };
}

export async function svgToPngBlob(
  svg: string,
  scale = Math.max(2, window.devicePixelRatio || 1),
): Promise<Blob> {
  const { width, height } = svgDimensions(svg);
  const source = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(source);

  try {
    const image = new Image();
    image.decoding = 'async';
    image.src = url;
    await image.decode();

    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(width * scale);
    canvas.height = Math.ceil(height * scale);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('PNG 캔버스를 만들 수 없습니다.');
    context.scale(scale, scale);
    context.drawImage(image, 0, 0, width, height);

    const png = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/png'),
    );
    if (!png) throw new Error('PNG 이미지를 만들 수 없습니다.');
    return png;
  } finally {
    URL.revokeObjectURL(url);
  }
}
