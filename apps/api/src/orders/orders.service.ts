import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import {
  MenuItemEntity,
  OrderEntity,
  OrderLineEntity,
  RestaurantTableEntity,
} from '@tabley/database';
import { OrderChannel, OrderStatus } from '@tabley/shared';
import { TablesService } from '../tables/tables.service';
import { OrdersGateway } from '../realtime/orders.gateway';

interface LineInput {
  menuItemId: string;
  quantity: number;
  note?: string;
}

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(OrderEntity) private readonly orders: Repository<OrderEntity>,
    @InjectRepository(OrderLineEntity) private readonly lines: Repository<OrderLineEntity>,
    @InjectRepository(MenuItemEntity) private readonly menuItems: Repository<MenuItemEntity>,
    @InjectRepository(RestaurantTableEntity)
    private readonly tables: Repository<RestaurantTableEntity>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly tablesService: TablesService,
    private readonly gateway: OrdersGateway,
  ) {}

  async placeFromTable(input: {
    slug: string;
    tableToken: string;
    lines: LineInput[];
    customerNote?: string;
    guestSessionId?: string | null;
  }) {
    if (input.lines.length === 0) {
      throw new BadRequestException({ code: 'EMPTY_ORDER', message: 'Order has no lines' });
    }

    const { tenant, table } = await this.tablesService.resolvePublicToken(
      input.slug,
      input.tableToken,
    );

    const menuItemIds = input.lines.map((l) => l.menuItemId);
    const items = await this.menuItems.find({
      where: { tenantId: tenant.id, id: In(menuItemIds), available: true },
    });
    if (items.length !== new Set(menuItemIds).size) {
      throw new BadRequestException({
        code: 'INVALID_LINES',
        message: 'One or more items are unavailable or do not belong to this restaurant',
      });
    }
    const itemsById = new Map(items.map((i) => [i.id, i]));

    const created = await this.dataSource.transaction(async (m) => {
      const orderRepo = m.getRepository(OrderEntity);
      const lineRepo = m.getRepository(OrderLineEntity);

      let totalCents = 0;
      const order = orderRepo.create({
        tenantId: tenant.id,
        tableId: table.id,
        status: OrderStatus.PENDING_CONFIRMATION,
        channel: OrderChannel.DINE_IN,
        customerNote: input.customerNote ?? null,
        guestSessionId: input.guestSessionId ?? null,
      });
      const savedOrder = await orderRepo.save(order);

      const lineRows = input.lines.map((l) => {
        const item = itemsById.get(l.menuItemId)!;
        const lineTotal = item.priceCents * l.quantity;
        totalCents += lineTotal;
        return lineRepo.create({
          tenantId: tenant.id,
          orderId: savedOrder.id,
          menuItemId: item.id,
          itemNameSnapshot: item.name,
          unitPriceCents: item.priceCents,
          quantity: l.quantity,
          note: l.note ?? null,
        });
      });
      await lineRepo.save(lineRows);

      savedOrder.totalCents = totalCents;
      return orderRepo.save(savedOrder);
    });

    this.gateway.emitOrderEvent(tenant.id, 'order.created', {
      id: created.id,
      status: created.status,
      tableId: created.tableId,
      totalCents: created.totalCents,
    });

    return {
      id: created.id,
      status: created.status,
      totalCents: created.totalCents,
      placedAt: created.createdAt,
    };
  }

  async getPublicOrderStatus(orderId: string, tableToken: string) {
    const order = await this.orders.findOne({ where: { id: orderId } });
    if (!order || !order.tableId) {
      throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Order not found' });
    }
    const table = await this.tables.findOne({
      where: { id: order.tableId, tenantId: order.tenantId, tokenHash: tableToken },
    });
    if (!table) {
      throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Order not found' });
    }
    const lines = await this.lines.find({ where: { orderId: order.id } });
    return {
      id: order.id,
      status: order.status,
      channel: order.channel,
      totalCents: order.totalCents,
      placedAt: order.createdAt,
      confirmedAt: order.confirmedAt,
      tableLabel: table.label,
      lines: lines.map((l) => ({
        id: l.id,
        name: l.itemNameSnapshot,
        unitPriceCents: l.unitPriceCents,
        quantity: l.quantity,
        note: l.note,
      })),
    };
  }

  async callWaiter(slug: string, tableToken: string, reason?: string) {
    const { tenant, table } = await this.tablesService.resolvePublicToken(slug, tableToken);
    this.gateway.emitTenantEvent(tenant.id, 'waiter.called', {
      tableId: table.id,
      tableLabel: table.label,
      reason: reason ?? null,
      at: new Date().toISOString(),
    });
    return { ok: true };
  }

  async listForTenant(tenantId: string, status?: string) {
    const orders = await this.orders.find({
      where: { tenantId, ...(status ? { status } : {}) },
      order: { createdAt: 'DESC' },
      take: 100,
    });
    if (orders.length === 0) return [];
    const orderIds = orders.map((o) => o.id);
    const lines = await this.lines.find({ where: { orderId: In(orderIds) } });
    const tableIds = orders.map((o) => o.tableId).filter((x): x is string => !!x);
    const tables = tableIds.length
      ? await this.tables.find({ where: { id: In(tableIds) } })
      : [];
    const tablesById = new Map(tables.map((t) => [t.id, t]));
    const linesByOrder = new Map<string, OrderLineEntity[]>();
    for (const l of lines) {
      const arr = linesByOrder.get(l.orderId) ?? [];
      arr.push(l);
      linesByOrder.set(l.orderId, arr);
    }
    return orders.map((o) => ({
      id: o.id,
      status: o.status,
      channel: o.channel,
      totalCents: o.totalCents,
      customerNote: o.customerNote,
      placedAt: o.createdAt,
      tableLabel: o.tableId ? tablesById.get(o.tableId)?.label ?? null : null,
      lines: (linesByOrder.get(o.id) ?? []).map((l) => ({
        id: l.id,
        name: l.itemNameSnapshot,
        unitPriceCents: l.unitPriceCents,
        quantity: l.quantity,
        note: l.note,
      })),
    }));
  }

  async confirm(tenantId: string, id: string, userId: string) {
    return this.transition(tenantId, id, userId, OrderStatus.IN_KITCHEN, 'order.confirmed');
  }

  markReady(tenantId: string, id: string, userId: string) {
    return this.transition(tenantId, id, userId, OrderStatus.READY, 'order.ready');
  }

  markServed(tenantId: string, id: string, userId: string) {
    return this.transition(tenantId, id, userId, OrderStatus.SERVED, 'order.served');
  }

  markPaid(tenantId: string, id: string, userId: string) {
    return this.transition(tenantId, id, userId, OrderStatus.PAID, 'order.paid');
  }

  cancel(tenantId: string, id: string, userId: string) {
    return this.transition(tenantId, id, userId, OrderStatus.CANCELLED, 'order.cancelled');
  }

  private async transition(
    tenantId: string,
    id: string,
    userId: string,
    to: OrderStatus,
    eventName: string,
  ) {
    const order = await this.orders.findOne({ where: { id, tenantId } });
    if (!order) throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Not found' });

    if (!isAllowed(order.status as OrderStatus, to)) {
      throw new ConflictException({
        code: 'INVALID_STATE',
        message: `Cannot move from ${order.status} to ${to}`,
      });
    }

    order.status = to;
    if (to === OrderStatus.IN_KITCHEN) {
      order.confirmedByUserId = userId;
      order.confirmedAt = new Date();
    }
    const saved = await this.orders.save(order);

    this.gateway.emitOrderEvent(tenantId, eventName, {
      id: saved.id,
      status: saved.status,
      tableId: saved.tableId,
      totalCents: saved.totalCents,
    });

    return saved;
  }
}

const ALLOWED: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING_CONFIRMATION]: [OrderStatus.IN_KITCHEN, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.IN_KITCHEN, OrderStatus.CANCELLED],
  [OrderStatus.IN_KITCHEN]: [OrderStatus.READY, OrderStatus.CANCELLED],
  [OrderStatus.READY]: [OrderStatus.SERVED, OrderStatus.CANCELLED],
  [OrderStatus.SERVED]: [OrderStatus.PAID],
  [OrderStatus.PAID]: [],
  [OrderStatus.CANCELLED]: [],
};

function isAllowed(from: OrderStatus, to: OrderStatus) {
  return ALLOWED[from]?.includes(to) ?? false;
}
