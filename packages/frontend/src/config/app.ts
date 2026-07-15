/** 본 프로젝트 소스 저장소. 공개 후 URL 채우기. 비우면 푸터에서 링크 숨김 */
export const APP_GIT_URL = "https://git.sejong.dev/ysj7705/sejong-office";

export const APP_NAME = "sejong-office";

export const APP_DISPLAY_NAME = "Sejong Office";

/** HWP/HWPX — client-side rhwp */
export const HWP_EXTENSIONS = new Set(["hwp", "hwpx"]);

/** Office/PDF — OnlyOffice */
export const OFFICE_EXTENSIONS = new Set([
  "docx",
  "xlsx",
  "pptx",
  "odt",
  "ods",
  "odp",
  "doc",
  "xls",
  "ppt",
  "rtf",
  "txt",
  "pdf",
  "csv",
  "dotx",
  "xltx",
  "potx",
]);

export function extensionOf(filename: string): string {
  const idx = filename.lastIndexOf(".");
  if (idx < 0) return "";
  return filename.slice(idx + 1).toLowerCase();
}

export function isHwp(filename: string): boolean {
  return HWP_EXTENSIONS.has(extensionOf(filename));
}

export function isOffice(filename: string): boolean {
  return OFFICE_EXTENSIONS.has(extensionOf(filename));
}
