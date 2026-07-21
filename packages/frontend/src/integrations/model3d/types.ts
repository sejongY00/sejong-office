import type { AnimationClip, Object3D } from 'three';

export interface ModelStats {
  objects: number;
  meshes: number;
  vertices: number;
  triangles: number;
  animations: number;
}

export interface ModelTreeNode {
  name: string;
  type: string;
  children: ModelTreeNode[];
}

export interface LoadedModel {
  object: Object3D;
  animations: AnimationClip[];
  stats: ModelStats;
  tree: ModelTreeNode;
}

export interface WorkerMesh {
  name: string;
  positions: Float32Array;
  normals?: Float32Array;
  indices: Uint32Array;
  color?: [number, number, number, number?];
  matrix?: number[];
}

export interface WorkerModelResult {
  meshes: WorkerMesh[];
}
