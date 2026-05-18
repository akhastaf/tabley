import { Injectable, NestMiddleware } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { NextFunction, Request, Response } from 'express';
import { Repository } from 'typeorm';
import { TenantEntity, TenantMemberEntity } from '@tabley/database';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    @InjectRepository(TenantEntity) private readonly tenants: Repository<TenantEntity>,
    @InjectRepository(TenantMemberEntity)
    private readonly members: Repository<TenantMemberEntity>,
  ) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    const r = req as Request & {
      auth?: { user?: { id: string } } | null;
      tenant?: { id: string; slug: string; role: string } | null;
    };
    r.tenant = null;

    const slug = (req.headers['x-tenant-slug'] as string | undefined)?.toLowerCase();
    if (!slug || !r.auth?.user?.id) {
      return next();
    }

    const tenant = await this.tenants.findOne({ where: { slug } });
    if (!tenant) return next();

    const membership = await this.members.findOne({
      where: { tenantId: tenant.id, userId: r.auth.user.id },
    });
    if (!membership) return next();

    r.tenant = { id: tenant.id, slug: tenant.slug, role: membership.role };
    next();
  }
}
