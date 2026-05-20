import type { Request } from 'express';

/**
 * Small zero-dep cookie parser. We use this instead of the `cookie-parser`
 * middleware so the container's pre-baked node_modules doesn't have to be
 * rebuilt every time we touch the cookie flow.
 */
export function readCookie(req: Request, name: string): string | null {
  const header = req.headers.cookie;
  if (!header || typeof header !== 'string') return null;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    if (k === name) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return null;
}
