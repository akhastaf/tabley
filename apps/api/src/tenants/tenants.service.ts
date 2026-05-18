import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { TenantEntity, TenantMemberEntity } from '@tabley/database';
import { UserRole } from '@tabley/shared';

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,60}[a-z0-9]$/;

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(TenantEntity) private readonly tenants: Repository<TenantEntity>,
    @InjectRepository(TenantMemberEntity)
    private readonly members: Repository<TenantMemberEntity>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async listForUser(userId: string) {
    const rows = await this.members.find({ where: { userId } });
    if (rows.length === 0) return [];
    const tenants = await this.tenants.findByIds(rows.map((r) => r.tenantId));
    const byId = new Map(tenants.map((t) => [t.id, t]));
    return rows
      .map((r) => {
        const t = byId.get(r.tenantId);
        if (!t) return null;
        return {
          id: t.id,
          slug: t.slug,
          name: t.name,
          plan: t.plan,
          role: r.role,
          deliveryEnabled: t.deliveryEnabled,
          defaultLocale: t.defaultLocale,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }

  async create(input: { slug: string; name: string }, ownerUserId: string) {
    const slug = input.slug.toLowerCase();
    if (!SLUG_PATTERN.test(slug)) {
      throw new ConflictException({
        code: 'INVALID_SLUG',
        message: 'Slug must be lowercase alphanumerics and dashes, 3-62 chars',
      });
    }
    const existing = await this.tenants.findOne({ where: { slug } });
    if (existing) {
      throw new ConflictException({ code: 'SLUG_TAKEN', message: 'That slug is already taken' });
    }

    return this.dataSource.transaction(async (m) => {
      const tenant = m.getRepository(TenantEntity).create({
        slug,
        name: input.name.trim(),
        plan: 'free',
        defaultLocale: 'en',
      });
      const saved = await m.getRepository(TenantEntity).save(tenant);
      await m.getRepository(TenantMemberEntity).save(
        m.getRepository(TenantMemberEntity).create({
          tenantId: saved.id,
          userId: ownerUserId,
          role: UserRole.MANAGER,
        }),
      );
      return {
        id: saved.id,
        slug: saved.slug,
        name: saved.name,
        plan: saved.plan,
        role: UserRole.MANAGER,
        deliveryEnabled: saved.deliveryEnabled,
        defaultLocale: saved.defaultLocale,
      };
    });
  }

  async getBySlugForUser(slug: string, userId: string) {
    const tenant = await this.tenants.findOne({ where: { slug } });
    if (!tenant) throw new NotFoundException({ code: 'TENANT_NOT_FOUND', message: 'Tenant not found' });
    const member = await this.members.findOne({ where: { tenantId: tenant.id, userId } });
    if (!member) throw new NotFoundException({ code: 'TENANT_NOT_FOUND', message: 'Tenant not found' });
    return { tenant, role: member.role };
  }
}
