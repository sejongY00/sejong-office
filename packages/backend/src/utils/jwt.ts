import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export function signOnlyOfficePayload(payload: Record<string, unknown>): string {
  return jwt.sign(payload, config.jwtSecret, { algorithm: 'HS256' });
}

export function verifyOnlyOfficeToken(token: string): Record<string, unknown> {
  return jwt.verify(token, config.jwtSecret, {
    algorithms: ['HS256'],
  }) as Record<string, unknown>;
}

/** Extract JWT from Authorization header or body.token (OnlyOffice callback styles). */
export function extractToken(req: {
  headers: { authorization?: string };
  body?: { token?: string };
  query?: { token?: string };
}): string | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    return auth.slice(7);
  }
  if (typeof req.body?.token === 'string') {
    return req.body.token;
  }
  if (typeof req.query?.token === 'string') {
    return req.query.token;
  }
  return null;
}
