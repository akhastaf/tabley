import type { CookieOptions, Request } from 'express';

/**
 * Cookie attributes for the public (customer-facing) cookies — the device id
 * and the resume-session id.
 *
 * In production the web app and the API live on different origins (e.g.
 * `tabley-web-*.up.railway.app` ↔ `tabley-api-*.up.railway.app`), and because
 * `*.up.railway.app` is on the Public Suffix List the browser treats them as
 * *different sites*. A `SameSite=Lax` cookie set by the API is therefore never
 * sent back on the cross-site XHR/fetch the web app makes, which is what caused
 * `DEVICE_COOKIE_MISSING` right after `/sessions/start` succeeded.
 *
 * `SameSite=None` makes the browser attach the cookie on cross-site requests,
 * but it is only accepted alongside `Secure` (HTTPS). In dev we stay on plain
 * `localhost` HTTP, so we fall back to `Lax` (same-site there anyway).
 */
export function publicCookieOptions(): CookieOptions {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    sameSite: isProd ? 'none' : 'lax',
    secure: isProd,
    path: '/',
  };
}

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
