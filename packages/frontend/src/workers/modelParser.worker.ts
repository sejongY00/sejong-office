/// <reference lib="webworker" />

import createOcct from 'occt-import-js';
import { IfcAPI } from 'web-ifc';
import type {
  WorkerMesh,
  WorkerModelResult,
} from '@/integrations/model3d/types';

interface ParseRequest {
  id: number;
  format: 'step' | 'ifc';
  buffer: ArrayBuffer;
}

interface ProgressMessage {
  id: number;
  type: 'progress';
  value: number;
  label: string;
}

interface ResultMessage {
  id: number;
  type: 'result';
  result: WorkerModelResult;
}

interface ErrorMessage {
  id: number;
  type: 'error';
  message: string;
}

function progress(
  id: number,
  value: number,
  label: string,
): ProgressMessage {
  return { id, type: 'progress', value, label };
}

async function parseStep(id: number, buffer: ArrayBuffer) {
  self.postMessage(progress(id, 0.15, 'OpenCascade WASM 초기화 중'));
  const occt = await createOcct({
    locateFile: () => '/viewer-assets/wasm/occt-import-js.wasm',
  });
  self.postMessage(progress(id, 0.35, 'STEP 형상 분석 중'));
  const imported = occt.ReadStepFile(new Uint8Array(buffer), {
    linearUnit: 'meter',
  });
  if (!imported.success) {
    throw new Error('STEP 형상을 해석하지 못했습니다.');
  }

  const meshes: WorkerMesh[] = imported.meshes.map((mesh, index) => ({
    name: mesh.name || `STEP Mesh ${index + 1}`,
    positions: new Float32Array(mesh.attributes.position.array),
    normals: mesh.attributes.normal
      ? new Float32Array(mesh.attributes.normal.array)
      : undefined,
    indices: new Uint32Array(mesh.index.array),
    color: mesh.color ? [...mesh.color, 1] : undefined,
  }));
  self.postMessage(progress(id, 0.9, 'STEP 메시 전송 중'));
  return meshes;
}

async function parseIfc(id: number, buffer: ArrayBuffer) {
  self.postMessage(progress(id, 0.1, 'web-ifc WASM 초기화 중'));
  const api = new IfcAPI();
  api.SetWasmPath('/viewer-assets/wasm/', true);
  await api.Init();

  self.postMessage(progress(id, 0.25, 'IFC 모델 분석 중'));
  const modelId = api.OpenModel(new Uint8Array(buffer), {
    COORDINATE_TO_ORIGIN: true,
    CIRCLE_SEGMENTS: 16,
    MEMORY_LIMIT: 1024 * 1024 * 1024,
  });
  if (modelId < 0) {
    throw new Error('IFC 모델을 열지 못했습니다.');
  }

  const meshes: WorkerMesh[] = [];
  try {
    api.StreamAllMeshes(modelId, (flatMesh, index, total) => {
      const placed = flatMesh.geometries;
      for (let i = 0; i < placed.size(); i += 1) {
        const placement = placed.get(i);
        const geometry = api.GetGeometry(
          modelId,
          placement.geometryExpressID,
        );
        const source = api.GetVertexArray(
          geometry.GetVertexData(),
          geometry.GetVertexDataSize(),
        );
        const positions = new Float32Array((source.length / 6) * 3);
        const normals = new Float32Array((source.length / 6) * 3);
        for (let sourceIndex = 0, targetIndex = 0; sourceIndex < source.length; sourceIndex += 6) {
          positions[targetIndex] = source[sourceIndex];
          normals[targetIndex] = source[sourceIndex + 3];
          positions[targetIndex + 1] = source[sourceIndex + 1];
          normals[targetIndex + 1] = source[sourceIndex + 4];
          positions[targetIndex + 2] = source[sourceIndex + 2];
          normals[targetIndex + 2] = source[sourceIndex + 5];
          targetIndex += 3;
        }
        const indices = new Uint32Array(
          api.GetIndexArray(
            geometry.GetIndexData(),
            geometry.GetIndexDataSize(),
          ),
        );
        geometry.delete();
        meshes.push({
          name: `IFC #${flatMesh.expressID}`,
          positions,
          normals,
          indices,
          color: [
            placement.color.x,
            placement.color.y,
            placement.color.z,
            placement.color.w,
          ],
          matrix: Array.from(placement.flatTransformation),
        });
      }
      if (index % 20 === 0 || index + 1 === total) {
        self.postMessage(
          progress(
            id,
            0.25 + (0.65 * (index + 1)) / Math.max(1, total),
            `IFC 형상 ${index + 1}/${total}`,
          ),
        );
      }
    });
  } finally {
    api.CloseModel(modelId);
  }
  return meshes;
}

self.onmessage = async (event: MessageEvent<ParseRequest>) => {
  const { id, format, buffer } = event.data;
  try {
    const meshes =
      format === 'step'
        ? await parseStep(id, buffer)
        : await parseIfc(id, buffer);
    const result: ResultMessage = {
      id,
      type: 'result',
      result: { meshes },
    };
    const transfer = meshes.flatMap((mesh) => [
      mesh.positions.buffer,
      ...(mesh.normals ? [mesh.normals.buffer] : []),
      mesh.indices.buffer,
    ]);
    self.postMessage(result, { transfer });
  } catch (reason) {
    const response: ErrorMessage = {
      id,
      type: 'error',
      message:
        reason instanceof Error
          ? reason.message
          : '모델 파싱 중 알 수 없는 오류가 발생했습니다.',
    };
    self.postMessage(response);
  }
};

export {};
