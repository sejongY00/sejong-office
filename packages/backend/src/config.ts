import './loadEnv.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function env(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  jwtSecret: env('JWT_SECRET', 'dev-only-change-me'),
  publicUrl: env('PUBLIC_URL', 'http://localhost:3000').replace(/\/$/, ''),
  internalUrl: env('INTERNAL_URL', 'http://localhost:3000').replace(/\/$/, ''),
  onlyOfficeUrl: env('ONLYOFFICE_URL', 'http://localhost:8080').replace(/\/$/, ''),
  onlyOfficeInternalUrl: env(
    'ONLYOFFICE_INTERNAL_URL',
    process.env.ONLYOFFICE_URL ?? 'http://localhost:8080',
  ).replace(/\/$/, ''),
  sessionTtlMs: Number(process.env.SESSION_TTL_MS ?? 900_000),
  tempDir: env('TEMP_DIR', '/tmp/sejong'),
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB ?? 50),
  publicDir: path.resolve(__dirname, '../public'),
};

/** Extensions handled by OnlyOffice (not HWP — that stays client-side via rhwp). */
export const OFFICE_EXTENSIONS = new Set([
  'docx',
  'xlsx',
  'pptx',
  'odt',
  'ods',
  'odp',
  'doc',
  'xls',
  'ppt',
  'rtf',
  'txt',
  'pdf',
  'csv',
  'dotx',
  'xltx',
  'potx',
]);

export const HWP_EXTENSIONS = new Set(['hwp', 'hwpx']);
