export type DocumentType = 'word' | 'cell' | 'slide' | 'pdf';

export type SessionDoc = {
  sessionId: string;
  docId: string;
  key: string;
  filename: string;
  originalFilename: string;
  mime: string;
  fileType: string;
  documentType: DocumentType;
  path: string;
  token: string;
  lastSeenAt: number;
  createdAt: number;
};

export type Session = {
  sessionId: string;
  lastSeenAt: number;
  createdAt: number;
  docs: Map<string, SessionDoc>;
};
