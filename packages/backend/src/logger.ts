import type { RequestHandler } from 'express';

type LogLevel = 'INFO' | 'WARN' | 'ERROR';
type LogDetails = Record<string, unknown>;

function formatDetails(details?: LogDetails): string {
  if (!details) return '';
  const normalized = Object.fromEntries(
    Object.entries(details).map(([key, value]) => [
      key,
      value instanceof Error ? value.stack ?? value.message : value,
    ]),
  );
  return ` ${JSON.stringify(normalized)}`;
}

function write(level: LogLevel, message: string, details?: LogDetails) {
  const line = `[${new Date().toISOString()}] [${level}] ${message}${formatDetails(details)}`;
  if (level === 'ERROR') {
    console.error(line);
  } else if (level === 'WARN') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  info: (message: string, details?: LogDetails) =>
    write('INFO', message, details),
  warn: (message: string, details?: LogDetails) =>
    write('WARN', message, details),
  error: (message: string, details?: LogDetails) =>
    write('ERROR', message, details),
};

function browserSummary(userAgent = ''): string {
  const browsers: [RegExp, string][] = [
    [/Edg\/([\d.]+)/, 'Edge'],
    [/OPR\/([\d.]+)/, 'Opera'],
    [/Chrome\/([\d.]+)/, 'Chrome'],
    [/Firefox\/([\d.]+)/, 'Firefox'],
    [/Version\/([\d.]+).*Safari\//, 'Safari'],
    [/curl\/([\d.]+)/, 'curl'],
  ];
  const browser = browsers
    .map(([pattern, name]) => {
      const match = userAgent.match(pattern);
      return match ? `${name} ${match[1]}` : null;
    })
    .find(Boolean) ?? 'Unknown';

  const os = /Windows NT/.test(userAgent)
    ? 'Windows'
    : /Android/.test(userAgent)
      ? 'Android'
      : /iPhone|iPad/.test(userAgent)
        ? 'iOS'
        : /Mac OS X/.test(userAgent)
          ? 'macOS'
          : /Linux/.test(userAgent)
            ? 'Linux'
            : 'Unknown';

  return `${browser} / ${os}`;
}

function requestIp(forwardedFor: string | string[] | undefined, remote?: string) {
  const forwarded = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : forwardedFor?.split(',')[0]?.trim();
  return (forwarded || remote || '-').replace(/^::ffff:/, '');
}

export const requestLogger: RequestHandler = (req, res, next) => {
  const startedAt = performance.now();
  res.on('finish', () => {
    const durationMs = Math.round(performance.now() - startedAt);
    const ip = requestIp(
      req.headers['x-forwarded-for'],
      req.socket.remoteAddress,
    );
    const browser = browserSummary(req.headers['user-agent']);
    const message =
      `${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs}ms` +
      ` ip=${ip} browser="${browser}"`;
    if (res.statusCode >= 500) logger.error(message);
    else if (res.statusCode >= 400) logger.warn(message);
    else logger.info(message);
  });
  next();
};
