import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import type { Request } from 'express';

export interface TenantCtx {
  id: string;
  slug: string;
  role: string;
}

export const CurrentTenant = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest<Request & { tenant?: TenantCtx | null }>();
  return req.tenant ?? null;
});
