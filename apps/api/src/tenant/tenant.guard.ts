import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

export const TENANT_ROLES_KEY = 'tenant_roles';
export const TenantRoles = (...roles: string[]) => SetMetadata(TENANT_ROLES_KEY, roles);

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context
      .switchToHttp()
      .getRequest<Request & { tenant?: { role: string } | null }>();

    if (!req.tenant) {
      throw new ForbiddenException({
        code: 'TENANT_REQUIRED',
        message: 'Tenant context missing or you are not a member of this tenant',
      });
    }

    const allowed = this.reflector.getAllAndOverride<string[] | undefined>(TENANT_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (allowed && allowed.length > 0 && !allowed.includes(req.tenant.role)) {
      throw new ForbiddenException({ code: 'FORBIDDEN_ROLE', message: 'Insufficient role' });
    }
    return true;
  }
}
