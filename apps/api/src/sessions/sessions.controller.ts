import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { SessionsService } from './sessions.service';

const DEVICE_COOKIE = 'tabley_device';
const SESSION_COOKIE = 'tabley_session';
const DEVICE_TTL_DAYS = 365;
const SESSION_TTL_HOURS = 8;

const startSchema = z.object({
  slug: z.string().min(1),
  tableToken: z.string().min(8),
  displayName: z.string().min(1).max(80).optional(),
});

function ensureDeviceCookie(req: Request, res: Response): string {
  let id = req.cookies?.[DEVICE_COOKIE];
  if (!id || typeof id !== 'string' || id.length < 16) {
    id = randomBytes(24).toString('hex');
    res.cookie(DEVICE_COOKIE, id, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: DEVICE_TTL_DAYS * 24 * 3600 * 1000,
      path: '/',
    });
  }
  return id;
}

function requireDeviceCookie(req: Request): string {
  const id = req.cookies?.[DEVICE_COOKIE];
  if (!id || typeof id !== 'string' || id.length < 16) {
    throw new BadRequestException({
      code: 'DEVICE_COOKIE_MISSING',
      message: 'Start a session first',
    });
  }
  return id;
}

@Controller('public/sessions')
export class SessionsController {
  constructor(private readonly service: SessionsService) {}

  @Post('start')
  async start(
    @Body(new ZodValidationPipe(startSchema)) body: z.infer<typeof startSchema>,
    @Req() req: Request & { auth?: { user?: { id: string; name?: string | null } } | null },
    @Res({ passthrough: true }) res: Response,
  ) {
    const deviceId = ensureDeviceCookie(req, res);
    const user = req.auth?.user ?? null;
    const session = await this.service.startOrResume({
      slug: body.slug,
      tableToken: body.tableToken,
      deviceId,
      displayName: body.displayName ?? user?.name ?? undefined,
      userId: user?.id ?? null,
    });
    // Stash the session id in a cookie so the customer page can resume after
    // a hard refresh without losing context.
    res.cookie(SESSION_COOKIE, session.id, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: SESSION_TTL_HOURS * 3600 * 1000,
      path: '/',
    });
    return session;
  }

  @Get(':id')
  async get(@Param('id') id: string, @Req() req: Request) {
    const deviceId = requireDeviceCookie(req);
    return this.service.detail(id, deviceId);
  }

  @Patch(':id/participants/:pid/approve')
  async approve(
    @Param('id') id: string,
    @Param('pid') pid: string,
    @Req() req: Request,
  ) {
    const deviceId = requireDeviceCookie(req);
    await this.service.approve(id, deviceId, pid);
    return this.service.detail(id, deviceId);
  }

  @Delete(':id/participants/:pid')
  async remove(
    @Param('id') id: string,
    @Param('pid') pid: string,
    @Req() req: Request,
  ) {
    const deviceId = requireDeviceCookie(req);
    await this.service.remove(id, deviceId, pid);
    return this.service.detail(id, deviceId);
  }

  @Post(':id/leave')
  async leave(@Param('id') id: string, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const deviceId = requireDeviceCookie(req);
    await this.service.leave(id, deviceId);
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  }

  @Post(':id/end')
  async end(@Param('id') id: string, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const deviceId = requireDeviceCookie(req);
    await this.service.end(id, deviceId);
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  }
}
