import {
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderEntity } from '@tabley/database';
import { OrdersService } from '../orders/orders.service';
import { PosApiKeyGuard } from './pos-api-key.guard';
import { CurrentPosTenant } from './current-pos-tenant.decorator';
import type { PosTenantCtx } from './pos-api-key.guard';

const POS_USER_ID = '__pos__';

@Controller('integrations/pos/orders')
@UseGuards(PosApiKeyGuard)
export class PosOrdersController {
  constructor(
    private readonly orders: OrdersService,
    @InjectRepository(OrderEntity) private readonly ordersRepo: Repository<OrderEntity>,
  ) {}

  @Get()
  async list(
    @CurrentPosTenant() t: PosTenantCtx,
    @Query('status') status?: string,
  ) {
    return this.orders.listForTenant(t.id, status);
  }

  @Get(':id')
  async get(@CurrentPosTenant() t: PosTenantCtx, @Param('id') id: string) {
    const order = await this.ordersRepo.findOne({ where: { id, tenantId: t.id } });
    if (!order) throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Not found' });
    return order;
  }

  @Patch(':id/confirm')
  async confirm(@CurrentPosTenant() t: PosTenantCtx, @Param('id') id: string) {
    await this.ensureOwned(t.id, id);
    return this.orders.confirm(t.id, id, POS_USER_ID);
  }

  @Patch(':id/ready')
  async ready(@CurrentPosTenant() t: PosTenantCtx, @Param('id') id: string) {
    await this.ensureOwned(t.id, id);
    return this.orders.markReady(t.id, id, POS_USER_ID);
  }

  @Patch(':id/served')
  async served(@CurrentPosTenant() t: PosTenantCtx, @Param('id') id: string) {
    await this.ensureOwned(t.id, id);
    return this.orders.markServed(t.id, id, POS_USER_ID);
  }

  @Patch(':id/paid')
  async paid(@CurrentPosTenant() t: PosTenantCtx, @Param('id') id: string) {
    await this.ensureOwned(t.id, id);
    return this.orders.markPaid(t.id, id, POS_USER_ID);
  }

  @Patch(':id/cancel')
  async cancel(@CurrentPosTenant() t: PosTenantCtx, @Param('id') id: string) {
    await this.ensureOwned(t.id, id);
    return this.orders.cancel(t.id, id, POS_USER_ID);
  }

  private async ensureOwned(tenantId: string, id: string) {
    const exists = await this.ordersRepo.exists({ where: { id, tenantId } });
    if (!exists) {
      throw new ForbiddenException({
        code: 'ORDER_NOT_FOR_TENANT',
        message: 'This order does not belong to your tenant',
      });
    }
  }
}
