import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThan, Not, Repository } from 'typeorm';
import {
  OrderEntity,
  RestaurantTableEntity,
  TableSessionEntity,
  TableSessionParticipantEntity,
} from '@tabley/database';

export interface FloorTable {
  id: string;
  label: string;
  capacity: number;
  isActive: boolean;
  session: {
    id: string;
    startedAt: Date;
    expiresAt: Date;
    participantCount: number;
    pendingCount: number;
    ownerName: string | null;
    openOrderCount: number;
    openOrderTotalCents: number;
  } | null;
}

@Injectable()
export class FloorService {
  constructor(
    @InjectRepository(RestaurantTableEntity)
    private readonly tables: Repository<RestaurantTableEntity>,
    @InjectRepository(TableSessionEntity)
    private readonly sessions: Repository<TableSessionEntity>,
    @InjectRepository(TableSessionParticipantEntity)
    private readonly participants: Repository<TableSessionParticipantEntity>,
    @InjectRepository(OrderEntity)
    private readonly orders: Repository<OrderEntity>,
  ) {}

  async list(tenantId: string): Promise<FloorTable[]> {
    const tables = await this.tables.find({
      where: { tenantId, isActive: true },
      order: { createdAt: 'ASC' },
    });
    if (tables.length === 0) return [];

    const now = new Date();
    const sessions = await this.sessions.find({
      where: {
        tenantId,
        tableId: In(tables.map((t) => t.id)),
        status: 'active',
        expiresAt: MoreThan(now),
      },
      order: { createdAt: 'DESC' },
    });
    const sessionByTable = new Map<string, TableSessionEntity>();
    for (const s of sessions) {
      if (!sessionByTable.has(s.tableId)) sessionByTable.set(s.tableId, s);
    }

    const sessionIds = [...sessionByTable.values()].map((s) => s.id);
    const allParticipants = sessionIds.length
      ? await this.participants.find({ where: { sessionId: In(sessionIds) } })
      : [];
    const participantsBySession = new Map<string, TableSessionParticipantEntity[]>();
    for (const p of allParticipants) {
      const arr = participantsBySession.get(p.sessionId) ?? [];
      arr.push(p);
      participantsBySession.set(p.sessionId, arr);
    }

    const openOrders = sessionIds.length
      ? await this.orders.find({
          where: {
            tenantId,
            guestSessionId: In(sessionIds),
            status: Not(In(['paid', 'cancelled'])),
          },
        })
      : [];
    const ordersBySession = new Map<string, OrderEntity[]>();
    for (const o of openOrders) {
      if (!o.guestSessionId) continue;
      const arr = ordersBySession.get(o.guestSessionId) ?? [];
      arr.push(o);
      ordersBySession.set(o.guestSessionId, arr);
    }

    return tables.map((t) => {
      const s = sessionByTable.get(t.id) ?? null;
      if (!s) {
        return {
          id: t.id,
          label: t.label,
          capacity: t.capacity,
          isActive: t.isActive,
          session: null,
        };
      }
      const ps = (participantsBySession.get(s.id) ?? []).filter((p) => !p.leftAt);
      const owner = ps.find((p) => p.role === 'owner');
      const orders = ordersBySession.get(s.id) ?? [];
      return {
        id: t.id,
        label: t.label,
        capacity: t.capacity,
        isActive: t.isActive,
        session: {
          id: s.id,
          startedAt: s.createdAt,
          expiresAt: s.expiresAt,
          participantCount: ps.filter((p) => p.role !== 'pending').length,
          pendingCount: ps.filter((p) => p.role === 'pending').length,
          ownerName: owner?.displayName ?? null,
          openOrderCount: orders.length,
          openOrderTotalCents: orders.reduce((sum, o) => sum + o.totalCents, 0),
        },
      };
    });
  }
}
