import {
  BufferGeometry,
  Color,
  Group,
  Points,
  PointsMaterial,
} from 'three';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import type { ModelPropertyGroup, ModelStats, ModelTreeNode } from './types';

export function isPlyFileName(name: string) {
  return /\.ply$/i.test(name);
}

export function isNoFacesImportError(message: string) {
  return /no faces/i.test(message);
}

export async function createPointCloudFromPly(file: File): Promise<{
  object: Group;
  pointCount: number;
  hasColors: boolean;
  stats: ModelStats;
  tree: ModelTreeNode;
  groups: ModelPropertyGroup[];
}> {
  const buffer = await file.arrayBuffer();
  const geometry = new PLYLoader().parse(buffer) as BufferGeometry;
  const position = geometry.getAttribute('position');
  if (!position || position.count < 1) {
    throw new Error('PLY에 표시할 포인트가 없습니다.');
  }

  geometry.computeBoundingSphere();
  const hasColors = Boolean(geometry.getAttribute('color'));
  const radius = geometry.boundingSphere?.radius || 1;
  const material = new PointsMaterial({
    size: Math.max(radius / 250, 0.0005),
    sizeAttenuation: true,
    vertexColors: hasColors,
    color: hasColors ? new Color(0xffffff) : new Color(0x4fc3f7),
  });

  const points = new Points(geometry, material);
  points.name = file.name;
  const object = new Group();
  object.name = file.name;
  object.add(points);

  const pointCount = position.count;
  const stats: ModelStats = {
    nodes: 1,
    meshes: 0,
    meshInstances: 0,
    vertices: pointCount,
    triangles: 0,
    materials: 1,
  };
  const tree: ModelTreeNode = {
    id: 'pointcloud-root',
    name: file.name,
    type: '포인트 클라우드',
    children: [
      {
        id: 'pointcloud-points',
        name: `포인트 ${pointCount.toLocaleString()}개`,
        type: 'points',
        children: [],
      },
    ],
  };
  const groups: ModelPropertyGroup[] = [
    {
      name: '포인트 클라우드',
      properties: [
        { name: '파일', value: file.name },
        { name: '포인트', value: pointCount.toLocaleString() },
        { name: '정점 색', value: hasColors ? '있음' : '없음' },
      ],
    },
  ];

  return { object, pointCount, hasColors, stats, tree, groups };
}
