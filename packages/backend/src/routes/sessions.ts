import { Router } from 'express';
import {
  createSession,
  deleteSession,
  getSession,
  touchSession,
} from '../services/sessionStore.js';
import { requireSession, SESSION_COOKIE } from '../middleware/session.js';

export const sessionsRouter = Router();

/** Create session, or reuse existing cookie session so in-app navigation keeps docs. */
sessionsRouter.post('/', (req, res) => {
  const existingId = req.cookies?.[SESSION_COOKIE] as string | undefined;
  if (existingId && getSession(existingId)) {
    touchSession(existingId);
    res.json({ sessionId: existingId, reused: true });
    return;
  }

  const session = createSession();
  res.cookie(SESSION_COOKIE, session.sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  });
  res.json({ sessionId: session.sessionId, reused: false });
});

sessionsRouter.get('/me', (req, res) => {
  const existingId = req.cookies?.[SESSION_COOKIE] as string | undefined;
  if (!existingId || !getSession(existingId)) {
    res.status(401).json({ error: 'session_required' });
    return;
  }
  touchSession(existingId);
  res.json({ sessionId: existingId });
});

sessionsRouter.post('/heartbeat', requireSession, (req, res) => {
  const sessionId = res.locals.sessionId as string;
  touchSession(sessionId);
  res.json({ ok: true });
});

async function endSessionHandler(
  req: import('express').Request,
  res: import('express').Response,
) {
  const sessionId =
    (req.cookies?.[SESSION_COOKIE] as string | undefined) ??
    (req.header('x-session-id') as string | undefined) ??
    (typeof req.body?.sessionId === 'string' ? req.body.sessionId : undefined);

  if (!sessionId) {
    res.json({ ok: true });
    return;
  }

  await deleteSession(sessionId);
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.json({ ok: true });
}

sessionsRouter.delete('/', endSessionHandler);
/** sendBeacon / keepalive 호환 */
sessionsRouter.post('/end', endSessionHandler);
