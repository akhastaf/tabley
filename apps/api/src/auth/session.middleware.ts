import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { auth } from './auth';

@Injectable()
export class SessionMiddleware implements NestMiddleware {
  async use(req: Request, _res: Response, next: NextFunction) {
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (Array.isArray(v)) headers.set(k, v.join(','));
      else if (v != null) headers.set(k, String(v));
    }
    try {
      const session = await auth.api.getSession({ headers });
      (req as Request & { auth?: unknown }).auth = session ?? null;
    } catch {
      (req as Request & { auth?: unknown }).auth = null;
    }
    next();
  }
}
