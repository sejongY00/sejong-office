/** 본 프로젝트 소스 저장소. 공개 후 URL 채우기. 비우면 푸터에서 링크 숨김 */
export const APP_GIT_URL = "https://github.com/sejongY00/sejong-office";

/**
 * Browser-only office editor (ranuts/document, OnlyOffice + x2t WASM), opened in a new tab.
 * Built by sejongY00/office-editor onto GitHub Pages at a domain root (ranuts uses root-absolute
 * paths such as /sdkjs/…, so a /office-editor/ sub-path breaks conversion). Override with
 * VITE_OFFICE_EDITOR_URL (trailing slash).
 */
export const OFFICE_EDITOR_URL: string =
  import.meta.env.VITE_OFFICE_EDITOR_URL || "https://editor.sejong.dev/";

export const APP_NAME = "sejong-office";

export const APP_DISPLAY_NAME = "Sejong Office";

export type DiagramKind = "excalidraw" | "mermaid" | "drawio";
export type ViewerKind = "cad" | "model3d" | "illustrator" | "photoshop" | "markdown";
export type ToolKind = "scanner" | "imageedit";

const DIAGRAM_EXTENSION_KIND: Record<string, DiagramKind> = {
  excalidraw: "excalidraw",
  mmd: "mermaid",
  mermaid: "mermaid",
  drawio: "drawio",
  xml: "drawio",
};

/** Image files opened in the document scanner tool. */
export const SCANNER_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "bmp",
]);

const TOOL_EXTENSION_KIND: Record<string, ToolKind> = {
  png: "scanner",
  jpg: "scanner",
  jpeg: "scanner",
  webp: "scanner",
  gif: "scanner",
  bmp: "scanner",
  ico: "imageedit",
};

/** Online3DViewer import formats (+ zip container). */
export const MODEL3D_EXTENSIONS = [
  "3dm",
  "3ds",
  "3mf",
  "amf",
  "bim",
  "brp",
  "brep",
  "dae",
  "fbx",
  "fcstd",
  "gltf",
  "glb",
  "ifc",
  "igs",
  "iges",
  "stp",
  "step",
  "stl",
  "obj",
  "off",
  "ply",
  "wrl",
  "zip",
] as const;

const VIEWER_EXTENSION_KIND: Record<string, ViewerKind> = {
  dxf: "cad",
  dwg: "cad",
  ai: "illustrator",
  psd: "photoshop",
  md: "markdown",
  markdown: "markdown",
  mdown: "markdown",
  ...Object.fromEntries(
    MODEL3D_EXTENSIONS.map((ext) => [ext, "model3d" as const]),
  ),
};

/** HWP/HWPX — client-side rhwp */
export const HWP_EXTENSIONS = new Set(["hwp", "hwpx"]);

/** Office/PDF — ranuts/document (in-browser ONLYOFFICE) */
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

export function diagramKindFor(filename: string): DiagramKind | null {
  return DIAGRAM_EXTENSION_KIND[extensionOf(filename)] ?? null;
}

export function viewerKindFor(filename: string): ViewerKind | null {
  return VIEWER_EXTENSION_KIND[extensionOf(filename)] ?? null;
}

export function toolKindFor(filename: string): ToolKind | null {
  return TOOL_EXTENSION_KIND[extensionOf(filename)] ?? null;
}

export function isScannerImage(filename: string): boolean {
  return SCANNER_EXTENSIONS.has(extensionOf(filename));
}
