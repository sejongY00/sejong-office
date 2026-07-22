declare module '@pdf-lib/fontkit' {
  import type { Fontkit } from 'pdf-lib';
  const fontkit: Fontkit;
  export default fontkit;
}

declare module 'jscanify/client' {
  const jscanify: unknown;
  export default jscanify;
}
