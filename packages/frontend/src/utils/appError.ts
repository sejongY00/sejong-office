/** Error with a short machine code that EditorErrorState turns into a Korean title. */
export class AppError extends Error {
  readonly code: string;

  constructor(code: string, message?: string) {
    super(message ?? code);
    this.name = 'AppError';
    this.code = code;
  }
}

export type BlankDocumentType = 'docx' | 'xlsx' | 'pptx' | 'hwpx';

/** Blank templates ship as static files under public/templates/. */
export async function fetchBlankTemplate(type: BlankDocumentType): Promise<ArrayBuffer> {
  const res = await fetch(`${import.meta.env.BASE_URL}templates/blank.${type}`);
  if (!res.ok) {
    throw new AppError('template_missing', '빈 문서 템플릿을 불러오지 못했습니다.');
  }
  return res.arrayBuffer();
}
