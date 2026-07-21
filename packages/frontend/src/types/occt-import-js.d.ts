declare module 'occt-import-js' {
  interface OcctAttribute {
    array: number[];
  }

  interface OcctMesh {
    name: string;
    color?: [number, number, number];
    attributes: {
      position: OcctAttribute;
      normal?: OcctAttribute;
    };
    index: OcctAttribute;
  }

  interface OcctResult {
    success: boolean;
    meshes: OcctMesh[];
  }

  interface OcctApi {
    ReadStepFile(content: Uint8Array, params: unknown): OcctResult;
  }

  interface OcctOptions {
    locateFile?: (path: string) => string;
  }

  export default function createOcct(options?: OcctOptions): Promise<OcctApi>;
}
