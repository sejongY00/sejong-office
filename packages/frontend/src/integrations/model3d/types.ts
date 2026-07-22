export interface ModelStats {
  nodes: number;
  meshes: number;
  meshInstances: number;
  vertices: number;
  triangles: number;
  materials: number;
}

export interface ModelPropertyRow {
  name: string;
  value: string;
}

export interface ModelPropertyGroup {
  name: string;
  properties: ModelPropertyRow[];
}

export interface ModelTreeNode {
  id: string;
  name: string;
  type: string;
  meshInstanceKey?: string;
  children: ModelTreeNode[];
}

export type ExportFormatId =
  | 'glb'
  | 'gltf'
  | 'obj'
  | 'stl-binary'
  | 'stl-text'
  | 'ply-binary'
  | 'ply-text'
  | 'off'
  | '3dm'
  | 'bim';

export interface ExportOption {
  id: ExportFormatId;
  label: string;
  extension: string;
  format: 'text' | 'binary';
}

export const EXPORT_OPTIONS: ExportOption[] = [
  { id: 'glb', label: 'glTF Binary (.glb)', extension: 'glb', format: 'binary' },
  { id: 'gltf', label: 'glTF (.gltf)', extension: 'gltf', format: 'text' },
  { id: 'obj', label: 'Wavefront OBJ (.obj)', extension: 'obj', format: 'text' },
  {
    id: 'stl-binary',
    label: 'STL Binary (.stl)',
    extension: 'stl',
    format: 'binary',
  },
  { id: 'stl-text', label: 'STL Text (.stl)', extension: 'stl', format: 'text' },
  {
    id: 'ply-binary',
    label: 'PLY Binary (.ply)',
    extension: 'ply',
    format: 'binary',
  },
  { id: 'ply-text', label: 'PLY Text (.ply)', extension: 'ply', format: 'text' },
  { id: 'off', label: 'OFF (.off)', extension: 'off', format: 'text' },
  { id: '3dm', label: 'Rhino (.3dm)', extension: '3dm', format: 'binary' },
  { id: 'bim', label: 'Dotbim (.bim)', extension: 'bim', format: 'text' },
];
