import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import {
  DeliveryAddress,
  MenuItemEntity,
  OrderEntity,
  OrderLineEntity,
  RestaurantTableEntity,
  TenantEntity,
} from '@tabley/database';
import { OrderChannel, OrderStatus, UserRole } from '@tabley/shared';
import { TablesService } from '../tables/tables.service';
import { OrdersGateway } from '../realtime/orders.gateway';
import { WebhookService } from '../webhooks/webhook.service';
import { isOpenNow } from '../tenant-settings/opening-hours';

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
    @InjectRepository(TenantEntity) private readonly tenants: Repository<TenantEntity>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly tablesService: TablesService,
    private readonly gateway: OrdersGateway,
    private readonly webhooks: WebhookService,
  ) {}

  /**
   * Block order placement when the restaurant is outside its configured
   * opening hours. Tenants that have never set hours still serve orders
   * (isOpenNow returns true for null openingHours) so this is opt-in.
   */
  private assertOpen(tenant: Pick<TenantEntity, 'openingHours' | 'timezone'>) {
    const status = isOpenNow({
      openingHours: tenant.openingHours,
      timezone: tenant.timezone,
    });
    if (!status.open) {
      throw new ConflictException({
        code: 'RESTAURANT_CLOSED',
        message: 'The restaurant is closed right now — please come back during opening hours.',
      });
    }
  }

  async placeFromTable(input: {
    slug: string;
    tableToken: string;
    lines: LineInput[];
    customerNote?: string;
    guestSessionId?: string | null;
    customerUserId?: string | null;
  }) {
    if (input.lines.length === 0) {
      throw new BadRequestException({ code: 'EMPTY_ORDER', message: 'Order has no lines' });
    }

    const { tenant, table } = await this.tablesService.resolvePublicToken(
      input.slug,
      input.tableToken,
    );
    this.assertOpen(tenant);

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
        customerUserId: input.customerUserId ?? null,
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
      guestSessionId: created.guestSessionId,
    });
    void this.webhooks.enqueueOrderEvent({
      tenantId: tenant.id,
      event: 'order.created',
      orderId: created.id,
      status: created.status,
      channel: created.channel,
      totalCents: created.totalCents,
    });

    return {
      id: created.id,
      status: created.status,
      totalCents: created.totalCents,
      placedAt: created.createdAt,
    };
  }

  async placeForDelivery(input: {
    slug: string;
    lines: LineInput[];
    address: DeliveryAddress;
    phone: string;
    deliveryNotes?: string;
    customerNote?: string;
    guestSessionId?: string | null;
    customerUserId?: string | null;
  }) {
    if (input.lines.length === 0) {
      throw new BadRequestException({ code: 'EMPTY_ORDER', message: 'Order has no lines' });
    }
    const tenant = await this.tenants.findOne({
      where: { slug: input.slug, isActive: true },
    });
    if (!tenant) {
      throw new NotFoundException({ code: 'TENANT_NOT_FOUND', message: 'Restaurant not found' });
    }
    if (!tenant.deliveryEnabled) {
      throw new BadRequestException({
        code: 'DELIVERY_DISABLED',
        message: 'This restaurant does not take delivery orders',
      });
    }
    this.assertOpen(tenant);

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
        tableId: null,
        status: OrderStatus.PENDING_CONFIRMATION,
        channel: OrderChannel.DELIVERY,
        customerNote: input.customerNote ?? null,
        guestSessionId: input.guestSessionId ?? null,
        customerUserId: input.customerUserId ?? null,
        deliveryAddress: input.address,
        deliveryPhone: input.phone,
        deliveryNotes: input.deliveryNotes ?? null,
      });
      const savedOrder = await orderRepo.save(order);

      const lineRows = input.lines.map((l) => {
        const item = itemsById.get(l.menuItemId)!;
        totalCents += item.priceCents * l.quantity;
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
      tableId: null,
      totalCents: created.totalCents,
      channel: OrderChannel.DELIVERY,
    });
    void this.webhooks.enqueueOrderEvent({
      tenantId: tenant.id,
      event: 'order.created',
      orderId: created.id,
      status: created.status,
      channel: created.channel,
      totalCents: created.totalCents,
    });

    return {
      id: created.id,
      status: created.status,
      totalCents: created.totalCents,
      placedAt: created.createdAt,
      channel: created.channel,
    };
  }

  async listForCustomer(userId: string) {
    const orders = await this.orders.find({
      where: { customerUserId: userId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
    if (orders.length === 0) return [];
    const orderIds = orders.map((o) => o.id);
    const tenantIds = [...new Set(orders.map((o) => o.tenantId))];
    const tableIds = orders.map((o) => o.tableId).filter((x): x is string => !!x);
    const [lines, tenants, tables] = await Promise.all([
      this.lines.find({ where: { orderId: In(orderIds) } }),
      this.tenants.find({ where: { id: In(tenantIds) } }),
      tableIds.length
        ? this.tables.find({ where: { id: In(tableIds) } })
        : Promise.resolve([] as RestaurantTableEntity[]),
    ]);
    const tenantById = new Map(tenants.map((t) => [t.id, t]));
    const tableById = new Map(tables.map((t) => [t.id, t]));
    const linesByOrder = new Map<string, OrderLineEntity[]>();
    for (const l of lines) {
      const arr = linesByOrder.get(l.orderId) ?? [];
      arr.push(l);
      linesByOrder.set(l.orderId, arr);
    }
    return orders.map((o) => {
      const tenant = tenantById.get(o.tenantId);
      return {
        id: o.id,
        status: o.status,
        channel: o.channel,
        totalCents: o.totalCents,
        placedAt: o.createdAt,
        tenant: tenant
          ? { id: tenant.id, slug: tenant.slug, name: tenant.name }
          : null,
        tableLabel: o.tableId ? tableById.get(o.tableId)?.label ?? null : null,
        lines: (linesByOrder.get(o.id) ?? []).map((l) => ({
          id: l.id,
          menuItemId: l.menuItemId,
          name: l.itemNameSnapshot,
          unitPriceCents: l.unitPriceCents,
          quantity: l.quantity,
          note: l.note,
        })),
      };
    });
  }

  async getCustomerOrder(userId: string, orderId: string) {
    const order = await this.orders.findOne({
      where: { id: orderId, customerUserId: userId },
    });
    if (!order) {
      throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Order not found' });
    }
    const [lines, tenant, table] = await Promise.all([
      this.lines.find({ where: { orderId: order.id } }),
      this.tenants.findOne({ where: { id: order.tenantId } }),
      order.tableId
        ? this.tables.findOne({ where: { id: order.tableId } })
        : Promise.resolve(null),
    ]);
    return {
      id: order.id,
      status: order.status,
      totalCents: order.totalCents,
      placedAt: order.createdAt,
      tenant: tenant ? { id: tenant.id, slug: tenant.slug, name: tenant.name } : null,
      tableLabel: table?.label ?? null,
      lines: lines.map((l) => ({
        id: l.id,
        menuItemId: l.menuItemId,
        name: l.itemNameSnapshot,
        unitPriceCents: l.unitPriceCents,
        quantity: l.quantity,
        note: l.note,
      })),
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

  /** Customer-facing list of orders placed under a session. */
  async listForSession(tenantId: string, sessionId: string) {
    const orders = await this.orders.find({
      where: { tenantId, guestSessionId: sessionId },
      order: { createdAt: 'DESC' },
    });
    if (orders.length === 0) return [];
    const orderIds = orders.map((o) => o.id);
    const lines = await this.lines.find({ where: { orderId: In(orderIds) } });
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
      placedAt: o.createdAt,
      confirmedAt: o.confirmedAt,
      lines: (linesByOrder.get(o.id) ?? []).map((l) => ({
        id: l.id,
        name: l.itemNameSnapshot,
        unitPriceCents: l.unitPriceCents,
        quantity: l.quantity,
        note: l.note,
      })),
    }));
  }

  async listForTenant(
    tenantId: string,
    status?: string,
    viewer?: { role: string; userId: string },
  ) {
    // A waiter with a zone only sees orders on their tables; orders without a
    // table (delivery/takeaway) are not theirs. A waiter without a zone, and
    // every other role, sees everything.
    let zone: Set<string> | null = null;
    if (viewer?.role === UserRole.WAITER) {
      zone = await this.tablesService.servedTableIds(tenantId, viewer.userId);
    }
    const orders = await this.orders.find({
      where: {
        tenantId,
        ...(status ? { status } : {}),
        ...(zone ? { tableId: In([...zone]) } : {}),
      },
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
      deliveryAddress: o.deliveryAddress,
      deliveryPhone: o.deliveryPhone,
      deliveryNotes: o.deliveryNotes,
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

  /** Settle several served orders at once — e.g. closing out a whole table's
   *  bill in one action. All-or-nothing: if any order can't be paid, none are. */
  async markManyPaid(tenantId: string, ids: string[]) {
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length === 0) {
      throw new BadRequestException({ code: 'NO_ORDERS', message: 'No orders selected' });
    }
    const orders = await this.orders.find({ where: { id: In(uniqueIds), tenantId } });
    if (orders.length !== uniqueIds.length) {
      throw new NotFoundException({
        code: 'ORDER_NOT_FOUND',
        message: 'One or more orders were not found',
      });
    }
    for (const o of orders) {
      if (!isAllowed(o.status as OrderStatus, OrderStatus.PAID)) {
        throw new ConflictException({
          code: 'INVALID_STATE',
          message: `Order #${o.id.slice(0, 6)} is ${o.status} and cannot be paid`,
        });
      }
    }

    const saved = await this.dataSource.transaction(async (m) => {
      const repo = m.getRepository(OrderEntity);
      const out: OrderEntity[] = [];
      for (const o of orders) {
        o.status = OrderStatus.PAID;
        out.push(await repo.save(o));
      }
      return out;
    });

    for (const o of saved) {
      this.gateway.emitOrderEvent(tenantId, 'order.paid', {
        id: o.id,
        status: o.status,
        tableId: o.tableId,
        totalCents: o.totalCents,
        guestSessionId: o.guestSessionId,
      });
      void this.webhooks.enqueueOrderEvent({
        tenantId,
        event: 'order.paid',
        orderId: o.id,
        status: o.status,
        channel: o.channel,
        totalCents: o.totalCents,
      });
    }

    return { paid: saved.length, totalCents: saved.reduce((s, o) => s + o.totalCents, 0) };
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
      guestSessionId: saved.guestSessionId,
    });
    void this.webhooks.enqueueOrderEvent({
      tenantId,
      event: eventName,
      orderId: saved.id,
      status: saved.status,
      channel: saved.channel,
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
