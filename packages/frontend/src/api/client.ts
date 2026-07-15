export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(status: number, code: string, message?: string) {
    super(message ?? code);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function parseJson<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => ({}))) as {
    message?: string;
    error?: string;
  };
  if (!res.ok) {
    throw new ApiError(
      res.status,
      body.error ?? `http_${res.status}`,
      body.message ?? body.error ?? `HTTP ${res.status}`,
    );
  }
  return body as T;
}

export async function createSession(): Promise<{
  sessionId: string;
  reused?: boolean;
}> {
  return parseJson(
    await fetch('/api/sessions', { method: 'POST', credentials: 'include' }),
  );
}

export async function heartbeat(): Promise<void> {
  await fetch('/api/sessions/heartbeat', {
    method: 'POST',
    credentials: 'include',
  });
}

export async function endSession(): Promise<void> {
  await fetch('/api/sessions', {
    method: 'DELETE',
    credentials: 'include',
  });
}

export async function uploadDocument(file: File): Promise<{
  docId: string;
  filename: string;
  fileType: string;
  documentType: string;
}> {
  const form = new FormData();
  form.append('file', file);
  form.append('filename', file.name);
  return parseJson(
    await fetch('/api/documents', {
      method: 'POST',
      body: form,
      credentials: 'include',
    }),
  );
}

export type EditorConfigResponse = {
  documentType: string;
  document: Record<string, unknown>;
  editorConfig: Record<string, unknown>;
  token: string;
  documentServerUrl: string;
};

export async function fetchEditorConfig(
  docId: string,
): Promise<EditorConfigResponse> {
  return parseJson(
    await fetch(`/api/documents/${docId}/editor-config`, {
      credentials: 'include',
    }),
  );
}

export function downloadDocumentUrl(docId: string): string {
  return `/api/documents/${docId}/download`;
}
