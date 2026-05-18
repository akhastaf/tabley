import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { auth?: { user?: unknown } | null }>();
    if (!req.auth?.user) {
      throw new UnauthorizedException({ code: 'AUTH_REQUIRED', message: 'Not authenticated' });
    }
    return true;
  }
}
