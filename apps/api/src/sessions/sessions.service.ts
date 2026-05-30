import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, MoreThan, Repository } from 'typeorm';
import {
  RestaurantTableEntity,
  TableSessionEntity,
  TableSessionParticipantEntity,
  TenantEntity,
  type TableSessionRole,
} from '@tabley/database';
import { OrdersGateway } from '../realtime/orders.gateway';

const DEFAULT_TTL_MIN = 60;
const HARD_CAP_HOURS = 6;

interface StartArgs {
  slug: string;
  tableToken: string;
  deviceId: string;
  displayName?: string;
  userId?: string | null;
}

@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(TableSessionEntity)
    private readonly sessions: Repository<TableSessionEntity>,
    @InjectRepository(TableSessionParticipantEntity)
    private readonly participants: Repository<TableSessionParticipantEntity>,
    @InjectRepository(RestaurantTableEntity)
    private readonly tables: Repository<RestaurantTableEntity>,
    @InjectRepository(TenantEntity)
    private readonly tenants: Repository<TenantEntity>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly gateway: OrdersGateway,
  ) {}

  /**
   * Start a new session for this table, or resume the existing active one.
   * - First device to scan -> becomes the owner.
   * - Subsequent devices -> created as pending until the owner approves.
   * Same device hitting this twice -> idempotent (returns the existing row).
   */
  async startOrResume(args: StartArgs) {
    const slug = args.slug.toLowerCase();
    const tenant = await this.tenants.findOne({ where: { slug, isActive: true } });
    if (!tenant) {
      throw new NotFoundException({ code: 'TENANT_NOT_FOUND', message: 'Restaurant not found' });
    }
    const table = await this.tables.findOne({
      where: { tenantId: tenant.id, tokenHash: args.tableToken, isActive: true },
    });
    if (!table) {
      throw new NotFoundException({ code: 'TABLE_NOT_FOUND', message: 'Invalid table link' });
    }

    const now = new Date();
    const existing = await this.sessions.findOne({
      where: {
        tableId: table.id,
        status: 'active',
        expiresAt: MoreThan(now),
      },
      order: { createdAt: 'DESC' },
    });

    if (existing) {
      // Same device returning?
      const me = await this.participants.findOne({
        where: { sessionId: existing.id, deviceId: args.deviceId },
      });
      if (me) {
        // Bump activity, return enriched session.
        await this.bumpActivity(existing.id);
        return this.detail(existing.id, args.deviceId);
      }
      // New device joining an active session — pending until owner approves.
      const display = args.displayName?.trim() || this.autoDisplayName(existing.id);
      const created = await this.participants.save(
        this.participants.create({
          sessionId: existing.id,
          userId: args.userId ?? null,
          deviceId: args.deviceId,
          displayName: await display,
          role: 'pending',
          joinedAt: new Date(),
        }),
      );
      this.gateway.emitSessionEvent(existing.id, 'session.participant.pending', {
        participantId: created.id,
        displayName: created.displayName,
      });
      await this.bumpActivity(existing.id);
      return this.detail(existing.id, args.deviceId);
    }

    // No active session — this device becomes the owner of a fresh one.
    const expiresAt = new Date(now.getTime() + DEFAULT_TTL_MIN * 60 * 1000);
    const created = await this.dataSource.transaction(async (m) => {
      const session = await m.getRepository(TableSessionEntity).save(
        m.getRepository(TableSessionEntity).create({
          tenantId: tenant.id,
          tableId: table.id,
          status: 'active',
          expiresAt,
          lastActivityAt: now,
        }),
      );
      const display = args.displayName?.trim() || 'Host';
      await m.getRepository(TableSessionParticipantEntity).save(
        m.getRepository(TableSessionParticipantEntity).create({
          sessionId: session.id,
          userId: args.userId ?? null,
          deviceId: args.deviceId,
          displayName: display,
          role: 'owner',
          joinedAt: now,
        }),
      );
      return session;
    });
    this.gateway.emitTenantEvent(tenant.id, 'session.started', {
      sessionId: created.id,
      tableId: table.id,
      tableLabel: table.label,
    });
    return this.detail(created.id, args.deviceId);
  }

  /**
   * Get the full session payload from this device's perspective. Includes
   * everyone's display name/role + which row is "me".
   */
  async detail(sessionId: string, deviceId: string) {
    const session = await this.sessions.findOne({ where: { id: sessionId } });
    if (!session) {
      throw new NotFoundException({ code: 'SESSION_NOT_FOUND', message: 'Session not found' });
    }
    const all = await this.participants.find({
      where: { sessionId },
      order: { joinedAt: 'ASC' },
    });
    const [table, tenant] = await Promise.all([
      this.tables.findOne({ where: { id: session.tableId } }),
      this.tenants.findOne({ where: { id: session.tenantId } }),
    ]);
    const me = all.find((p) => p.deviceId === deviceId) ?? null;
    return {
      id: session.id,
      tenantId: session.tenantId,
      tenantSlug: tenant?.slug ?? null,
      tenantName: tenant?.name ?? null,
      tableId: session.tableId,
      tableLabel: table?.label ?? null,
      tableToken: table?.tokenHash ?? null,
      status: session.status,
      expiresAt: session.expiresAt,
      lastActivityAt: session.lastActivityAt,
      me: me
        ? {
            id: me.id,
            displayName: me.displayName,
            role: me.role,
            joinedAt: me.joinedAt,
          }
        : null,
      participants: all
        .filter((p) => !p.leftAt)
        .map((p) => ({
          id: p.id,
          displayName: p.displayName,
          role: p.role,
          joinedAt: p.joinedAt,
        })),
    };
  }

  /**
   * Same membership check as assertMember but allows closed/expired sessions
   * for read-only operations (e.g. listing past orders after the host ended
   * the table). The participant still has to be approved.
   */
  async assertMemberRead(sessionId: string, deviceId: string) {
    const session = await this.sessions.findOne({ where: { id: sessionId } });
    if (!session) {
      throw new NotFoundException({ code: 'SESSION_NOT_FOUND', message: 'Session not found' });
    }
    const me = await this.participants.findOne({ where: { sessionId, deviceId } });
    if (!me) {
      throw new ForbiddenException({ code: 'NOT_A_MEMBER', message: 'You are not at this table' });
    }
    if (me.role === 'pending') {
      throw new ForbiddenException({
        code: 'PENDING_APPROVAL',
        message: 'The table host has not approved you yet',
      });
    }
    return { session, participant: me };
  }

  /** Lookup an active session and verify the device is a non-pending member. */
  async assertMember(sessionId: string, deviceId: string) {
    const session = await this.sessions.findOne({ where: { id: sessionId } });
    if (!session) {
      throw new NotFoundException({ code: 'SESSION_NOT_FOUND', message: 'Session not found' });
    }
    if (session.status !== 'active') {
      throw new ConflictException({ code: 'SESSION_CLOSED', message: 'Session is closed' });
    }
    const me = await this.participants.findOne({ where: { sessionId, deviceId } });
    if (!me || me.leftAt) {
      throw new ForbiddenException({ code: 'NOT_A_MEMBER', message: 'You are not at this table' });
    }
    if (me.role === 'pending') {
      throw new ForbiddenException({
        code: 'PENDING_APPROVAL',
        message: 'The table host has not approved you yet',
      });
    }
    return { session, participant: me };
  }

  /**
   * Owner approves a pending participant. No-op if the participant is already
   * a member.
   */
  async approve(sessionId: string, ownerDeviceId: string, participantId: string) {
    const owner = await this.assertOwner(sessionId, ownerDeviceId);
    const target = await this.participants.findOne({
      where: { id: participantId, sessionId },
    });
    if (!target) {
      throw new NotFoundException({
        code: 'PARTICIPANT_NOT_FOUND',
        message: 'Participant not found',
      });
    }
    if (target.role === 'pending') {
      target.role = 'member';
      await this.participants.save(target);
      this.gateway.emitSessionEvent(sessionId, 'session.participant.approved', {
        participantId: target.id,
        displayName: target.displayName,
        approvedBy: owner.id,
      });
    }
    await this.bumpActivity(sessionId);
    return target;
  }

  async remove(sessionId: string, ownerDeviceId: string, participantId: string) {
    const owner = await this.assertOwner(sessionId, ownerDeviceId);
    if (owner.id === participantId) {
      throw new BadRequestException({
        code: 'CANNOT_REMOVE_SELF',
        message: 'Use end-session to close the table',
      });
    }
    const target = await this.participants.findOne({
      where: { id: participantId, sessionId },
    });
    if (!target) {
      throw new NotFoundException({
        code: 'PARTICIPANT_NOT_FOUND',
        message: 'Participant not found',
      });
    }
    target.leftAt = new Date();
    await this.participants.save(target);
    this.gateway.emitSessionEvent(sessionId, 'session.participant.removed', {
      participantId: target.id,
      displayName: target.displayName,
    });
    await this.bumpActivity(sessionId);
    return { ok: true };
  }

  async leave(sessionId: string, deviceId: string) {
    const me = await this.participants.findOne({ where: { sessionId, deviceId } });
    if (!me) {
      throw new NotFoundException({
        code: 'PARTICIPANT_NOT_FOUND',
        message: 'You are not in this session',
      });
    }
    me.leftAt = new Date();
    await this.participants.save(me);
    this.gateway.emitSessionEvent(sessionId, 'session.participant.left', {
      participantId: me.id,
      displayName: me.displayName,
    });
    return { ok: true };
  }

  async end(sessionId: string, ownerDeviceId: string) {
    const owner = await this.assertOwner(sessionId, ownerDeviceId);
    const session = await this.sessions.findOne({ where: { id: sessionId } });
    await this.sessions.update(
      { id: sessionId },
      {
        status: 'closed_by_owner',
        closedAt: new Date(),
        closedByUserId: owner.userId,
      },
    );
    // Customers at the table need to know to flip into the "closed" state.
    this.gateway.emitSessionEvent(sessionId, 'session.closed', { closedBy: 'owner' });
    // Staff floor view subscribes to the tenant room; without this, the
    // tile would stay "occupied" until somebody manually refreshes.
    if (session) {
      this.gateway.emitTenantEvent(session.tenantId, 'session.closed', {
        sessionId,
        tableId: session.tableId,
        closedBy: 'owner',
      });
    }
    return { ok: true };
  }

  /** Owner-only check: returns the owner participant row. */
  private async assertOwner(sessionId: string, deviceId: string) {
    const session = await this.sessions.findOne({ where: { id: sessionId } });
    if (!session) {
      throw new NotFoundException({ code: 'SESSION_NOT_FOUND', message: 'Session not found' });
    }
    if (session.status !== 'active') {
      throw new ConflictException({ code: 'SESSION_CLOSED', message: 'Session is closed' });
    }
    const me = await this.participants.findOne({
      where: { sessionId, deviceId, role: 'owner' },
    });
    if (!me) {
      throw new ForbiddenException({
        code: 'OWNER_REQUIRED',
        message: 'Only the table host can do this',
      });
    }
    return me;
  }

  /** Bump last_activity_at + sliding expiry, capped at HARD_CAP_HOURS. */
  private async bumpActivity(sessionId: string) {
    const session = await this.sessions.findOne({ where: { id: sessionId } });
    if (!session || session.status !== 'active') return;
    const now = new Date();
    const cap = new Date(session.createdAt.getTime() + HARD_CAP_HOURS * 3600 * 1000);
    const proposed = new Date(now.getTime() + DEFAULT_TTL_MIN * 60 * 1000);
    const next = proposed < cap ? proposed : cap;
    await this.sessions.update(
      { id: sessionId },
      { lastActivityAt: now, expiresAt: next },
    );
  }

  /** Auto-numbers guests so they're distinguishable on the host's screen. */
  private async autoDisplayName(sessionId: string): Promise<string> {
    const count = await this.participants.count({ where: { sessionId } });
    return `Guest ${count + 1}`;
  }
}
