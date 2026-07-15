import type { RequestHandler } from 'express';
import { getSession, touchSession } from '../services/sessionStore.js';

const COOKIE = 'sejong_sid';

export { COOKIE as SESSION_COOKIE };

export const requireSession: RequestHandler = (req, res, next) => {
  const sessionId =
    (req.cookies?.[COOKIE] as string | undefined) ??
    (req.header('x-session-id') as string | undefined);

  if (!sessionId || !getSession(sessionId)) {
    res.status(401).json({ error: 'session_required' });
    return;
  }

  touchSession(sessionId);
  res.locals.sessionId = sessionId;
  next();
};
