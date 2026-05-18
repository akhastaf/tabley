import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, ILike, Repository } from 'typeorm';
import {
  MenuItemEntity,
  OrderEntity,
  TenantEntity,
  TenantMemberEntity,
} from '@tabley/database';

export interface TenantSummary {
  id: string;
  slug: string;
  name: string;
  plan: string;
  isActive: boolean;
  deliveryEnabled: boolean;
  createdAt: Date;
  members: number;
  menuItems: number;
  orders: number;
}

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(TenantEntity) private readonly tenants: Repository<TenantEntity>,
    @InjectRepository(TenantMemberEntity)
    private readonly members: Repository<TenantMemberEntity>,
    @InjectRepository(MenuItemEntity) private readonly items: Repository<MenuItemEntity>,
    @InjectRepository(OrderEntity) private readonly orders: Repository<OrderEntity>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async listTenants(q?: string): Promise<TenantSummary[]> {
    const where = q
      ? [{ slug: ILike(`%${q.toLowerCase()}%`) }, { name: ILike(`%${q}%`) }]
      : undefined;
    const tenants = await this.tenants.find({
      where,
      order: { createdAt: 'DESC' },
      take: 200,
    });
    if (tenants.length === 0) return [];

    const summaries: TenantSummary[] = await Promise.all(
      tenants.map(async (t) => {
        const [members, menuItems, orders] = await Promise.all([
          this.members.count({ where: { tenantId: t.id } }),
          this.items.count({ where: { tenantId: t.id } }),
          this.orders.count({ where: { tenantId: t.id } }),
        ]);
        return {
          id: t.id,
          slug: t.slug,
          name: t.name,
          plan: t.plan,
          isActive: t.isActive,
          deliveryEnabled: t.deliveryEnabled,
          createdAt: t.createdAt,
          members,
          menuItems,
          orders,
        };
      }),
    );
    return summaries;
  }

  async getTenant(id: string) {
    const tenant = await this.tenants.findOne({ where: { id } });
    if (!tenant) throw new NotFoundException({ code: 'TENANT_NOT_FOUND', message: 'Not found' });
    const members = await this.members.find({ where: { tenantId: id }, order: { createdAt: 'ASC' } });
    return { tenant, members };
  }

  async updateTenant(
    id: string,
    patch: { isActive?: boolean; plan?: string; deliveryEnabled?: boolean },
  ) {
    const tenant = await this.tenants.findOne({ where: { id } });
    if (!tenant) throw new NotFoundException({ code: 'TENANT_NOT_FOUND', message: 'Not found' });
    if (patch.isActive !== undefined) tenant.isActive = patch.isActive;
    if (patch.plan !== undefined) tenant.plan = patch.plan;
    if (patch.deliveryEnabled !== undefined) tenant.deliveryEnabled = patch.deliveryEnabled;
    return this.tenants.save(tenant);
  }

  async disableUserMfa(userId: string) {
    // Set twoFactorEnabled=false on the user and wipe the twoFactor row.
    // Better Auth's admin plugin doesn't expose this directly so we go through
    // its own tables.
    await this.dataSource.query('UPDATE "user" SET "twoFactorEnabled" = false WHERE id = $1', [
      userId,
    ]);
    await this.dataSource.query('DELETE FROM "twoFactor" WHERE "userId" = $1', [userId]);
    return { ok: true };
  }

  async stats() {
    const [tenants, activeTenants, members, orders, menuItems] = await Promise.all([
      this.tenants.count(),
      this.tenants.count({ where: { isActive: true } }),
      this.members.count(),
      this.orders.count(),
      this.items.count(),
    ]);
    // Total user count from the Better Auth user table.
    const userCountRes = await this.dataSource.query<Array<{ c: string }>>(
      'SELECT count(*)::text as c FROM "user"',
    );
    const users = parseInt(userCountRes[0]?.c ?? '0', 10);
    return { tenants, activeTenants, users, members, orders, menuItems };
  }
}
