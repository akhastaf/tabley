import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'node:crypto';
import { RestaurantTableEntity, TenantEntity, TenantMemberEntity } from '@tabley/database';

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
    @InjectRepository(TenantMemberEntity)
    private readonly members: Repository<TenantMemberEntity>,
  ) {}

  list(tenantId: string) {
    return this.tables.find({
      where: { tenantId },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Set (or clear, with null) the waiter responsible for a table's zone. The
   * waiter must be a member of this tenant. Clearing leaves the table to
   * whichever waiters have no zone of their own.
   */
  async setAssignee(tenantId: string, id: string, waiterId: string | null) {
    const row = await this.tables.findOne({ where: { id, tenantId } });
    if (!row) throw new NotFoundException({ code: 'TABLE_NOT_FOUND', message: 'Not found' });
    if (waiterId) {
      const member = await this.members.findOne({ where: { tenantId, userId: waiterId } });
      if (!member) {
        throw new BadRequestException({
          code: 'NOT_A_MEMBER',
          message: 'That waiter is not on this team',
        });
      }
    }
    row.assignedWaiterId = waiterId;
    return this.tables.save(row);
  }

  /**
   * The set of table ids a waiter serves. Returns null when the waiter has no
   * zone — meaning they serve every table (the default).
   */
  async servedTableIds(tenantId: string, waiterId: string): Promise<Set<string> | null> {
    const rows = await this.tables.find({
      where: { tenantId, assignedWaiterId: waiterId },
      select: { id: true },
    });
    if (rows.length === 0) return null;
    return new Set(rows.map((r) => r.id));
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
