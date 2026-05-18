import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import type { Request } from 'express';
import type { PosTenantCtx } from './pos-api-key.guard';

export const CurrentPosTenant = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest<Request & { posTenant?: PosTenantCtx | null }>();
  return req.posTenant;
});
