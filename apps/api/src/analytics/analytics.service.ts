import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThan, Repository } from 'typeorm';
import {
  OrderEntity,
  OrderLineEntity,
  RestaurantTableEntity,
  TableSessionEntity,
} from '@tabley/database';

// Orders that are still "in play" — not yet paid out or cancelled.
const OPEN_STATUSES = ['pending_confirmation', 'confirmed', 'in_kitchen', 'ready', 'served'];

export interface PeriodTotals {
  orders: number;
  paidOrders: number;
  cancelled: number;
  revenueCents: number;
  avgOrderCents: number;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(OrderEntity) private readonly orders: Repository<OrderEntity>,
    @InjectRepository(OrderLineEntity) private readonly lines: Repository<OrderLineEntity>,
    @InjectRepository(RestaurantTableEntity)
    private readonly tables: Repository<RestaurantTableEntity>,
    @InjectRepository(TableSessionEntity)
    private readonly sessions: Repository<TableSessionEntity>,
  ) {}

  /**
   * Live snapshot for the dashboard landing: what's happening right now plus
   * today's running totals against yesterday for a quick "are we up?" read.
   */
  async overview(tenantId: string) {
    const now = new Date();
    const startToday = startOfDay(now);
    const startYesterday = new Date(startToday.getTime() - 86_400_000);

    const [activeSessions, activeTables, openOrders, today, yesterday] = await Promise.all([
      this.sessions.count({
        where: { tenantId, status: 'active', expiresAt: MoreThan(now) },
      }),
      this.tables.count({ where: { tenantId, isActive: true } }),
      this.orders.find({
        where: { tenantId, status: In(OPEN_STATUSES) },
        select: { id: true, status: true, totalCents: true },
      }),
      this.periodTotals(tenantId, startToday, now),
      this.periodTotals(tenantId, startYesterday, startToday),
    ]);

    const openByStatus: Record<string, number> = {};
    let openOrderTotalCents = 0;
    for (const o of openOrders) {
      openByStatus[o.status] = (openByStatus[o.status] ?? 0) + 1;
      openOrderTotalCents += o.totalCents;
    }

    return {
      now: now.toISOString(),
      live: {
        activeSessions,
        activeTables,
        openOrders: openOrders.length,
        openByStatus,
        pendingConfirmation: openByStatus['pending_confirmation'] ?? 0,
        inKitchen: openByStatus['in_kitchen'] ?? 0,
        readyForPickup: openByStatus['ready'] ?? 0,
        openOrderTotalCents,
      },
      today,
      yesterday,
    };
  }

  /**
   * Period KPIs with a comparison window so managers can answer "vs last week".
   * Everything is keyed off placed-at (created_at); revenue counts paid orders.
   */
  async kpis(
    tenantId: string,
    from: Date,
    to: Date,
    compareFrom: Date,
    compareTo: Date,
  ) {
    const [current, previous, topItems, byDay, byHour, channels] = await Promise.all([
      this.periodTotals(tenantId, from, to),
      this.periodTotals(tenantId, compareFrom, compareTo),
      this.topItems(tenantId, from, to),
      this.revenueByDay(tenantId, from, to),
      this.ordersByHour(tenantId, from, to),
      this.channelSplit(tenantId, from, to),
    ]);
    return {
      range: { from: from.toISOString(), to: to.toISOString() },
      compareRange: { from: compareFrom.toISOString(), to: compareTo.toISOString() },
      current,
      previous,
      topItems,
      byDay,
      byHour,
      channels,
    };
  }

  private async periodTotals(tenantId: string, from: Date, to: Date): Promise<PeriodTotals> {
    const rows = await this.orders
      .createQueryBuilder('o')
      .select('o.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(o.total_cents), 0)', 'total')
      .where('o.tenant_id = :tenantId', { tenantId })
      .andWhere('o.created_at >= :from AND o.created_at < :to', { from, to })
      .groupBy('o.status')
      .getRawMany<{ status: string; count: string; total: string }>();

    let orders = 0;
    let revenueCents = 0;
    let paidOrders = 0;
    let cancelled = 0;
    for (const r of rows) {
      const count = Number(r.count);
      if (r.status === 'cancelled') {
        cancelled += count;
        continue;
      }
      orders += count;
      if (r.status === 'paid') {
        paidOrders += count;
        revenueCents += Number(r.total);
      }
    }
    return {
      orders,
      paidOrders,
      cancelled,
      revenueCents,
      avgOrderCents: paidOrders > 0 ? Math.round(revenueCents / paidOrders) : 0,
    };
  }

  private async topItems(tenantId: string, from: Date, to: Date) {
    const rows = await this.lines
      .createQueryBuilder('l')
      .innerJoin(OrderEntity, 'o', 'o.id = l.order_id')
      .select('l.item_name_snapshot', 'name')
      .addSelect('SUM(l.quantity)', 'qty')
      .addSelect('SUM(l.quantity * l.unit_price_cents)', 'revenue')
      .where('l.tenant_id = :tenantId', { tenantId })
      .andWhere('o.created_at >= :from AND o.created_at < :to', { from, to })
      .andWhere("o.status <> 'cancelled'")
      .groupBy('l.item_name_snapshot')
      .orderBy('qty', 'DESC')
      .limit(8)
      .getRawMany<{ name: string; qty: string; revenue: string }>();
    return rows.map((r) => ({
      name: r.name,
      quantity: Number(r.qty),
      revenueCents: Number(r.revenue),
    }));
  }

  private async revenueByDay(tenantId: string, from: Date, to: Date) {
    const rows = await this.orders
      .createQueryBuilder('o')
      .select("to_char(date_trunc('day', o.created_at), 'YYYY-MM-DD')", 'day')
      .addSelect('COUNT(*)', 'orders')
      .addSelect(
        "COALESCE(SUM(CASE WHEN o.status = 'paid' THEN o.total_cents ELSE 0 END), 0)",
        'revenue',
      )
      .where('o.tenant_id = :tenantId', { tenantId })
      .andWhere('o.created_at >= :from AND o.created_at < :to', { from, to })
      .andWhere("o.status <> 'cancelled'")
      .groupBy('day')
      .orderBy('day', 'ASC')
      .getRawMany<{ day: string; orders: string; revenue: string }>();
    return rows.map((r) => ({
      day: r.day,
      orders: Number(r.orders),
      revenueCents: Number(r.revenue),
    }));
  }

  private async ordersByHour(tenantId: string, from: Date, to: Date) {
    const rows = await this.orders
      .createQueryBuilder('o')
      .select('EXTRACT(HOUR FROM o.created_at)', 'hour')
      .addSelect('COUNT(*)', 'orders')
      .where('o.tenant_id = :tenantId', { tenantId })
      .andWhere('o.created_at >= :from AND o.created_at < :to', { from, to })
      .andWhere("o.status <> 'cancelled'")
      .groupBy('hour')
      .getRawMany<{ hour: string; orders: string }>();
    const byHour = new Map(rows.map((r) => [Number(r.hour), Number(r.orders)]));
    return Array.from({ length: 24 }, (_, h) => ({ hour: h, orders: byHour.get(h) ?? 0 }));
  }

  private async channelSplit(tenantId: string, from: Date, to: Date) {
    const rows = await this.orders
      .createQueryBuilder('o')
      .select('o.channel', 'channel')
      .addSelect('COUNT(*)', 'orders')
      .addSelect(
        "COALESCE(SUM(CASE WHEN o.status = 'paid' THEN o.total_cents ELSE 0 END), 0)",
        'revenue',
      )
      .where('o.tenant_id = :tenantId', { tenantId })
      .andWhere('o.created_at >= :from AND o.created_at < :to', { from, to })
      .andWhere("o.status <> 'cancelled'")
      .groupBy('o.channel')
      .getRawMany<{ channel: string; orders: string; revenue: string }>();
    return rows.map((r) => ({
      channel: r.channel,
      orders: Number(r.orders),
      revenueCents: Number(r.revenue),
    }));
  }
}
