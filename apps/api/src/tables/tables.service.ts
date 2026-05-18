import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'node:crypto';
import { RestaurantTableEntity, TenantEntity } from '@tabley/database';

function generateToken() {
  return randomBytes(16).toString('hex');
}

@Injectable()
export class TablesService {
  constructor(
    @InjectRepository(RestaurantTableEntity)
    private readonly tables: Repository<RestaurantTableEntity>,
    @InjectRepository(TenantEntity)
    private readonly tenants: Repository<TenantEntity>,
  ) {}

  list(tenantId: string) {
    return this.tables.find({
      where: { tenantId },
      order: { createdAt: 'ASC' },
    });
  }

  async create(tenantId: string, input: { label: string; capacity?: number }) {
    const token = generateToken();
    const row = this.tables.create({
      tenantId,
      label: input.label.trim(),
      capacity: input.capacity ?? 4,
      tokenHash: token,
    });
    return this.tables.save(row);
  }

  async rotateToken(tenantId: string, id: string) {
    const row = await this.tables.findOne({ where: { id, tenantId } });
    if (!row) throw new NotFoundException({ code: 'TABLE_NOT_FOUND', message: 'Not found' });
    row.tokenHash = generateToken();
    return this.tables.save(row);
  }

  async remove(tenantId: string, id: string) {
    const row = await this.tables.findOne({ where: { id, tenantId } });
    if (!row) throw new NotFoundException({ code: 'TABLE_NOT_FOUND', message: 'Not found' });
    await this.tables.remove(row);
  }

  async resolvePublicToken(slug: string, token: string) {
    const tenant = await this.tenants.findOne({ where: { slug, isActive: true } });
    if (!tenant) throw new NotFoundException({ code: 'TENANT_NOT_FOUND', message: 'Restaurant not found' });
    const table = await this.tables.findOne({
      where: { tenantId: tenant.id, tokenHash: token, isActive: true },
    });
    if (!table) throw new NotFoundException({ code: 'TABLE_NOT_FOUND', message: 'Invalid table link' });
    return { tenant, table };
  }
}
