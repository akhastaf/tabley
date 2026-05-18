import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthSession } from './auth';

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest<Request & { auth?: AuthSession | null }>();
  return req.auth?.user ?? null;
});

export const CurrentSession = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest<Request & { auth?: AuthSession | null }>();
  return req.auth ?? null;
});
