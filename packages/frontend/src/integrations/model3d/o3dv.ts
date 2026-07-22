import { zipSync } from 'fflate';
import * as OV from 'online-3d-viewer';
import { MODEL3D_EXTENSIONS } from '@/config/app';
import { downloadBlob } from '@/utils/downloadBlob';
import type {
  ExportFormatId,
  ExportOption,
  ModelPropertyGroup,
  ModelStats,
  ModelTreeNode,
} from './types';
import { EXPORT_OPTIONS } from './types';

export const O3DV_ENV_MAP = [
  '/viewer-assets/o3dv/envmaps/fishermans_bastion/posx.jpg',
  '/viewer-assets/o3dv/envmaps/fishermans_bastion/negx.jpg',
  '/viewer-assets/o3dv/envmaps/fishermans_bastion/posy.jpg',
  '/viewer-assets/o3dv/envmaps/fishermans_bastion/negy.jpg',
  '/viewer-assets/o3dv/envmaps/fishermans_bastion/posz.jpg',
  '/viewer-assets/o3dv/envmaps/fishermans_bastion/negz.jpg',
] as const;

const PRIMARY_EXTENSIONS = new Set<string>(
  MODEL3D_EXTENSIONS.filter((ext) => ext !== 'zip'),
);

export function isPrimaryModelFile(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return PRIMARY_EXTENSIONS.has(ext);
}

export function findPrimaryModelFile(files: readonly File[]) {
  return (
    files.find((file) => isPrimaryModelFile(file.name)) ??
    files.find((file) => file.name.toLowerCase().endsWith('.zip')) ??
    null
  );
}

export function summarizeModel(model: OV.Model): ModelStats {
  return {
    nodes: model.NodeCount(),
    meshes: model.MeshCount(),
    meshInstances: model.MeshInstanceCount(),
    vertices: model.VertexCount(),
    triangles: model.TriangleCount(),
    materials: model.MaterialCount(),
  };
}

function collectPropertyGroups(object: {
  PropertyGroupCount(): number;
  GetPropertyGroup(index: number): OV.PropertyGroup;
}): ModelPropertyGroup[] {
  const groups: ModelPropertyGroup[] = [];
  for (let i = 0; i < object.PropertyGroupCount(); i += 1) {
    const group = object.GetPropertyGroup(i);
    const properties = [];
    for (let j = 0; j < group.PropertyCount(); j += 1) {
      const property = group.GetProperty(j);
      properties.push({
        name: String(property.name ?? ''),
        value: String(OV.PropertyToString(property) ?? ''),
      });
    }
    groups.push({
      name: String(group.name || `속성 ${i + 1}`),
      properties,
    });
  }
  return groups;
}

export function modelPropertyGroups(model: OV.Model): ModelPropertyGroup[] {
  return collectPropertyGroups(model);
}

export function meshInstancePropertyGroups(
  model: OV.Model,
  key: string,
): ModelPropertyGroup[] {
  const [nodeIdText, meshIndexText] = key.split(':');
  const nodeId = Number(nodeIdText);
  const meshIndex = Number(meshIndexText);
  if (!Number.isFinite(nodeId) || !Number.isFinite(meshIndex)) return [];
  const instance = model.GetMeshInstance(
    new OV.MeshInstanceId(nodeId, meshIndex),
  );
  if (!instance) return [];
  const mesh = instance.GetMesh();
  return [
    ...collectPropertyGroups(instance),
    ...collectPropertyGroups(mesh),
  ];
}

export function treeFromModel(model: OV.Model): ModelTreeNode {
  function fromNode(node: OV.Node): ModelTreeNode {
    const children: ModelTreeNode[] = node
      .GetChildNodes()
      .map((child: OV.Node) => fromNode(child));

    for (let i = 0; i < node.MeshIndexCount(); i += 1) {
      const meshIndex = node.GetMeshIndex(i);
      const mesh = model.GetMesh(meshIndex);
      const key = new OV.MeshInstanceId(node.GetId(), meshIndex).GetKey();
      children.push({
        id: key,
        name: mesh?.GetName?.() || `Mesh ${meshIndex}`,
        type: 'Mesh',
        meshInstanceKey: key,
        children: [],
      });
    }

    return {
      id: `node-${node.GetId()}`,
      name: node.GetName() || `Node ${node.GetId()}`,
      type: 'Node',
      children,
    };
  }

  return fromNode(model.GetRootNode());
}

export function importErrorMessage(error: OV.ImportError) {
  if (error.code === OV.ImportErrorCode.NoImportableFile) {
    return '가져올 수 있는 3D 모델 파일이 없습니다.';
  }
  if (error.code === OV.ImportErrorCode.FailedToLoadFile) {
    return '모델 파일을 읽지 못했습니다.';
  }
  if (error.code === OV.ImportErrorCode.ImportFailed) {
    return error.message
      ? `모델을 가져오지 못했습니다: ${error.message}`
      : '모델을 가져오지 못했습니다.';
  }
  return error.message || '알 수 없는 오류로 모델을 열지 못했습니다.';
}

export function exportOptionById(id: ExportFormatId): ExportOption {
  const option = EXPORT_OPTIONS.find((item) => item.id === id);
  if (!option) throw new Error(`알 수 없는 내보내기 형식: ${id}`);
  return option;
}

export function exportModel(
  model: OV.Model,
  option: ExportOption,
  visibleKeys: ReadonlySet<string> | null,
): Promise<OV.ExportedFile[]> {
  return new Promise((resolve, reject) => {
    const exporter = new OV.Exporter();
    const settings = new OV.ExporterSettings({});
    if (visibleKeys) {
      settings.isMeshVisible = (id: OV.MeshInstanceId) =>
        visibleKeys.has(id.GetKey());
    }
    exporter.Export(
      model,
      settings,
      option.format === 'text' ? OV.FileFormat.Text : OV.FileFormat.Binary,
      option.extension,
      {
        onSuccess: (files: OV.ExportedFile[]) => resolve(files),
        onError: () => reject(new Error('모델 내보내기에 실패했습니다.')),
      },
    );
  });
}

export async function downloadExportedFiles(
  files: OV.ExportedFile[],
  baseName: string,
  option: ExportOption,
) {
  if (files.length === 1) {
    const file = files[0];
    const name = file.GetName() || `${baseName}.${option.extension}`;
    const buffer = file.GetBufferContent() as ArrayBuffer;
    downloadBlob(
      new Blob([buffer], {
        type: 'application/octet-stream',
      }),
      name,
    );
    return;
  }

  const archive: Record<string, Uint8Array> = {};
  for (const file of files) {
    archive[file.GetName()] = new Uint8Array(file.GetBufferContent());
  }
  const zipped = zipSync(archive);
  downloadBlob(
    new Blob([Uint8Array.from(zipped)], { type: 'application/zip' }),
    `${baseName}.${option.extension}.zip`,
  );
}

export { OV, EXPORT_OPTIONS };
