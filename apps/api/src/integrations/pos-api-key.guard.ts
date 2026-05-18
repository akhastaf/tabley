import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { Repository } from 'typeorm';
import { TenantEntity } from '@tabley/database';

export interface PosTenantCtx {
  id: string;
  slug: string;
}

@Injectable()
export class PosApiKeyGuard implements CanActivate {
  constructor(
    @InjectRepository(TenantEntity) private readonly tenants: Repository<TenantEntity>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<Request & { posTenant?: PosTenantCtx | null }>();
    const headerKey = req.headers['x-tabley-api-key'];
    const key = Array.isArray(headerKey) ? headerKey[0] : headerKey;
    if (!key || typeof key !== 'string' || key.length < 16) {
      throw new UnauthorizedException({
        code: 'POS_API_KEY_MISSING',
        message: 'X-Tabley-API-Key header is required',
      });
    }
    const tenant = await this.tenants.findOne({ where: { posApiKey: key, isActive: true } });
    if (!tenant) {
      throw new UnauthorizedException({
        code: 'POS_API_KEY_INVALID',
        message: 'Invalid API key',
      });
    }
    req.posTenant = { id: tenant.id, slug: tenant.slug };
    return true;
  }
}
