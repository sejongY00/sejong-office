import {
  AnimationClip,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  LoadingManager,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Object3D,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { extensionOf } from '@/config/app';
import type {
  LoadedModel,
  ModelStats,
  ModelTreeNode,
  WorkerModelResult,
} from './types';

export type ModelProgress = (value: number, label: string) => void;

const MODEL_EXTENSIONS = new Set([
  'glb',
  'gltf',
  'obj',
  'step',
  'stp',
  'ifc',
]);

function normalizePath(value: string) {
  try {
    value = decodeURIComponent(value);
  } catch {
    // Keep the original URL when it contains malformed percent escapes.
  }
  return value
    .replace(/[?#].*$/, '')
    .replace(/\\/g, '/')
    .replace(/^\.?\//, '');
}

function basename(value: string) {
  return normalizePath(value).split('/').pop() ?? value;
}

class BrowserFileResolver {
  private readonly exact = new Map<string, File>();
  private readonly byName = new Map<string, File>();
  private readonly urls = new Map<File, string>();

  constructor(files: readonly File[]) {
    for (const file of files) {
      const relative = normalizePath(file.webkitRelativePath || file.name);
      this.exact.set(relative.toLowerCase(), file);
      this.byName.set(file.name.toLowerCase(), file);
    }
  }

  find(path: string) {
    const normalized = normalizePath(path);
    return (
      this.exact.get(normalized.toLowerCase()) ??
      this.byName.get(basename(normalized).toLowerCase())
    );
  }

  resolve = (url: string) => {
    if (/^(?:blob:|data:|https?:)/i.test(url)) return url;
    const file = this.find(url);
    if (!file) return url;
    let objectUrl = this.urls.get(file);
    if (!objectUrl) {
      objectUrl = URL.createObjectURL(file);
      this.urls.set(file, objectUrl);
    }
    return objectUrl;
  };

  dispose() {
    for (const url of this.urls.values()) URL.revokeObjectURL(url);
    this.urls.clear();
  }
}

function collectUris(value: unknown, result = new Set<string>()) {
  if (!value || typeof value !== 'object') return result;
  if (Array.isArray(value)) {
    value.forEach((item) => collectUris(item, result));
    return result;
  }
  for (const [key, item] of Object.entries(value)) {
    if (key === 'uri' && typeof item === 'string' && !item.startsWith('data:')) {
      result.add(item);
    } else {
      collectUris(item, result);
    }
  }
  return result;
}

function assertResources(
  references: Iterable<string>,
  resolver: BrowserFileResolver,
) {
  const missing = [...references].filter((uri) => !resolver.find(uri));
  if (missing.length) {
    throw new Error(
      `보조 파일이 누락되었습니다: ${missing.map(basename).join(', ')}`,
    );
  }
}

async function loadGltf(
  primary: File,
  manager: LoadingManager,
  resolver: BrowserFileResolver,
) {
  const loader = new GLTFLoader(manager);
  const extension = extensionOf(primary.name);
  let data: string | ArrayBuffer;
  if (extension === 'gltf') {
    const text = await primary.text();
    let manifest: unknown;
    try {
      manifest = JSON.parse(text);
    } catch {
      throw new Error('glTF JSON 형식이 올바르지 않습니다.');
    }
    assertResources(collectUris(manifest), resolver);
    data = text;
  } else {
    data = await primary.arrayBuffer();
  }
  const gltf = await loader.parseAsync(data, '');
  return {
    object: gltf.scene,
    animations: gltf.animations,
  };
}

function mtlTextureReferences(text: string) {
  const result = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const match =
      /^\s*(?:map_(?:ka|kd|ks|ke|ns|d|bump|disp|decal)|bump|norm)\s+(.+?)\s*$/i.exec(
        line,
      );
    if (!match) continue;
    const tokens = match[1].trim().split(/\s+/);
    const candidate = tokens[tokens.length - 1];
    if (candidate) result.add(candidate);
  }
  return result;
}

async function loadObj(
  primary: File,
  files: readonly File[],
  manager: LoadingManager,
  resolver: BrowserFileResolver,
) {
  const source = await primary.text();
  const declaredMtl = [
    ...source.matchAll(/^\s*mtllib\s+(.+?)\s*$/gim),
  ].map((match) => match[1]);
  if (declaredMtl.length) assertResources(declaredMtl, resolver);

  const mtl =
    declaredMtl.map((name) => resolver.find(name)).find(Boolean) ??
    files.find((file) => extensionOf(file.name) === 'mtl');
  const loader = new OBJLoader(manager);
  if (mtl) {
    const materialSource = await mtl.text();
    assertResources(mtlTextureReferences(materialSource), resolver);
    const materials = new MTLLoader(manager).parse(materialSource, '');
    materials.preload();
    loader.setMaterials(materials);
  }
  return {
    object: loader.parse(source),
    animations: [] as AnimationClip[],
  };
}

function parseInWorker(
  primary: File,
  format: 'step' | 'ifc',
  onProgress: ModelProgress,
  signal?: AbortSignal,
) {
  return new Promise<WorkerModelResult>(async (resolve, reject) => {
    const worker = new Worker(
      new URL('../../workers/modelParser.worker.ts', import.meta.url),
      { type: 'module' },
    );
    const id = Date.now();
    const abort = () => {
      worker.terminate();
      reject(new DOMException('모델 열기가 취소되었습니다.', 'AbortError'));
    };
    signal?.addEventListener('abort', abort, { once: true });
    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event.message || '모델 Worker 실행에 실패했습니다.'));
    };
    worker.onmessage = (event) => {
      if (event.data.id !== id) return;
      if (event.data.type === 'progress') {
        onProgress(event.data.value, event.data.label);
        return;
      }
      worker.terminate();
      signal?.removeEventListener('abort', abort);
      if (event.data.type === 'error') {
        reject(new Error(event.data.message));
      } else {
        resolve(event.data.result as WorkerModelResult);
      }
    };
    try {
      const buffer = await primary.arrayBuffer();
      worker.postMessage({ id, format, buffer }, [buffer]);
    } catch (reason) {
      worker.terminate();
      reject(reason);
    }
  });
}

function objectFromWorker(result: WorkerModelResult) {
  const group = new Group();
  for (const source of result.meshes) {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(source.positions, 3));
    if (source.normals) {
      geometry.setAttribute('normal', new BufferAttribute(source.normals, 3));
    } else {
      geometry.computeVertexNormals();
    }
    geometry.setIndex(new BufferAttribute(source.indices, 1));
    geometry.computeBoundingBox();
    const color = source.color ?? [0.72, 0.75, 0.8, 1];
    const material = new MeshStandardMaterial({
      color: new Color(color[0], color[1], color[2]),
      opacity: color[3] ?? 1,
      transparent: (color[3] ?? 1) < 1,
      metalness: 0,
      roughness: 0.75,
    });
    const mesh = new Mesh(geometry, material);
    mesh.name = source.name;
    if (source.matrix?.length === 16) {
      mesh.applyMatrix4(new Matrix4().fromArray(source.matrix));
    }
    group.add(mesh);
  }
  return group;
}

function summarize(object: Object3D, animations: AnimationClip[]) {
  const stats: ModelStats = {
    objects: 0,
    meshes: 0,
    vertices: 0,
    triangles: 0,
    animations: animations.length,
  };
  object.traverse((child) => {
    stats.objects += 1;
    if (!(child instanceof Mesh)) return;
    stats.meshes += 1;
    const position = child.geometry.getAttribute('position');
    stats.vertices += position?.count ?? 0;
    stats.triangles += child.geometry.index
      ? child.geometry.index.count / 3
      : (position?.count ?? 0) / 3;
  });
  return stats;
}

function treeFrom(object: Object3D): ModelTreeNode {
  return {
    name: object.name || object.type,
    type: object.type,
    children: object.children.map(treeFrom),
  };
}

export async function loadModelFiles(
  files: readonly File[],
  onProgress: ModelProgress,
  signal?: AbortSignal,
): Promise<LoadedModel> {
  const primary = files.find((file) =>
    MODEL_EXTENSIONS.has(extensionOf(file.name)),
  );
  if (!primary) {
    throw new Error('지원하는 3D 모델 파일을 선택해 주세요.');
  }

  const resolver = new BrowserFileResolver(files);
  const manager = new LoadingManager();
  manager.setURLModifier(resolver.resolve);
  manager.onProgress = (_url, loaded, total) => {
    onProgress(total ? loaded / total : 0.5, `리소스 ${loaded}/${total}`);
  };

  try {
    onProgress(0.05, `${primary.name} 읽는 중`);
    const extension = extensionOf(primary.name);
    let loaded: { object: Object3D; animations: AnimationClip[] };
    if (extension === 'glb' || extension === 'gltf') {
      loaded = await loadGltf(primary, manager, resolver);
    } else if (extension === 'obj') {
      loaded = await loadObj(primary, files, manager, resolver);
    } else {
      const parsed = await parseInWorker(
        primary,
        extension === 'ifc' ? 'ifc' : 'step',
        onProgress,
        signal,
      );
      loaded = { object: objectFromWorker(parsed), animations: [] };
    }
    signal?.throwIfAborted();
    onProgress(1, '모델 준비 완료');
    return {
      ...loaded,
      stats: summarize(loaded.object, loaded.animations),
      tree: treeFrom(loaded.object),
    };
  } finally {
    resolver.dispose();
  }
}
