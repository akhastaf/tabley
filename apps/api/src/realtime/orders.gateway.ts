import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Server, Socket } from 'socket.io';
import {
  OrderEntity,
  RestaurantTableEntity,
  TableSessionEntity,
  TableSessionParticipantEntity,
  TenantEntity,
  TenantMemberEntity,
} from '@tabley/database';
import { auth } from '../auth/auth';

function parseCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return null;
}

interface StaffSocketData {
  mode: 'staff';
  userId: string;
  tenantId: string;
  tenantSlug: string;
  role: string;
}

interface PublicSocketData {
  mode: 'public';
  tenantId: string;
  orderId: string;
}

interface SessionSocketData {
  mode: 'session';
  sessionId: string;
}

type SocketData = StaffSocketData | PublicSocketData | SessionSocketData;

@WebSocketGateway({
  namespace: '/orders',
  cors: {
    origin: (process.env.API_CORS_ORIGIN ?? 'http://localhost:3010').split(',').map((o) => o.trim()).filter(Boolean),
    credentials: true,
  },
})
export class OrdersGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(OrdersGateway.name);

  constructor(
    @InjectRepository(TenantEntity) private readonly tenants: Repository<TenantEntity>,
    @InjectRepository(TenantMemberEntity)
    private readonly members: Repository<TenantMemberEntity>,
    @InjectRepository(OrderEntity) private readonly orders: Repository<OrderEntity>,
    @InjectRepository(RestaurantTableEntity)
    private readonly tables: Repository<RestaurantTableEntity>,
    @InjectRepository(TableSessionEntity)
    private readonly sessionsRepo: Repository<TableSessionEntity>,
    @InjectRepository(TableSessionParticipantEntity)
    private readonly participantsRepo: Repository<TableSessionParticipantEntity>,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const mode = String(client.handshake.auth?.mode ?? 'staff');
      if (mode === 'public') {
        return this.connectPublic(client);
      }
      if (mode === 'session') {
        return this.connectSession(client);
      }
      return this.connectStaff(client);
    } catch (err) {
      this.logger.error(`ws handshake failed: ${(err as Error).message}`);
      client.disconnect(true);
    }
  }

  private async connectSession(client: Socket) {
    const sessionId = String(client.handshake.auth?.sessionId ?? '');
    // The device id lives in the httpOnly `tabley_device` cookie. The
    // browser can't read it, so we must pull it from the handshake cookie
    // header (socket.io forwards it when withCredentials: true). The
    // earlier code expected the client to pass it in `auth.deviceId`,
    // which made every session-mode socket fail and broke all realtime
    // updates on the customer page.
    const deviceId = parseCookie(client.handshake.headers.cookie, 'tabley_device');
    if (!sessionId || !deviceId) {
      client.disconnect(true);
      return;
    }
    // Verify this device is a participant in this session (any role, including
    // pending — pending participants need to receive their own approval event).
    const me = await this.participantsRepo.findOne({
      where: { sessionId, deviceId },
    });
    if (!me) {
      client.disconnect(true);
      return;
    }
    const session = await this.sessionsRepo.findOne({ where: { id: sessionId } });
    if (!session) {
      client.disconnect(true);
      return;
    }
    const data: SessionSocketData = { mode: 'session', sessionId };
    client.data = data;
    await client.join(`session:${sessionId}`);
    this.logger.log(`ws session joined ${sessionId.slice(0, 8)} as ${me.role}`);
  }

  private async connectStaff(client: Socket) {
    const cookieHeader = client.handshake.headers.cookie ?? '';
    const tenantSlug = String(
      client.handshake.auth?.tenantSlug ?? client.handshake.query?.tenantSlug ?? '',
    ).toLowerCase();
    if (!cookieHeader || !tenantSlug) {
      client.disconnect(true);
      return;
    }

    const headers = new Headers();
    headers.set('cookie', cookieHeader);
    const session = await auth.api.getSession({ headers });
    if (!session?.user) {
      client.disconnect(true);
      return;
    }
    const tenant = await this.tenants.findOne({ where: { slug: tenantSlug } });
    if (!tenant) {
      client.disconnect(true);
      return;
    }
    const member = await this.members.findOne({
      where: { tenantId: tenant.id, userId: session.user.id },
    });
    if (!member) {
      client.disconnect(true);
      return;
    }

    const data: StaffSocketData = {
      mode: 'staff',
      userId: session.user.id,
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      role: member.role,
    };
    client.data = data;
    await client.join(`tenant:${tenant.id}`);
    this.logger.log(`ws joined tenant:${tenant.slug} as ${member.role}`);
  }

  private async connectPublic(client: Socket) {
    const orderId = String(client.handshake.auth?.orderId ?? '');
    const tableToken = String(client.handshake.auth?.tableToken ?? '');
    if (!orderId || !tableToken) {
      client.disconnect(true);
      return;
    }
    const order = await this.orders.findOne({ where: { id: orderId } });
    if (!order || !order.tableId) {
      client.disconnect(true);
      return;
    }
    const table = await this.tables.findOne({
      where: { id: order.tableId, tenantId: order.tenantId, tokenHash: tableToken },
    });
    if (!table) {
      client.disconnect(true);
      return;
    }
    const data: PublicSocketData = {
      mode: 'public',
      tenantId: order.tenantId,
      orderId: order.id,
    };
    client.data = data;
    await client.join(`order:${order.id}`);
    this.logger.log(`ws public joined order:${order.id.slice(0, 8)}`);
  }

  handleDisconnect(client: Socket) {
    // socket.io initialises `client.data` to `{}`, so a failed handshake
    // (disconnected before we assigned our SocketData) still hits this
    // method with an empty object. Branch explicitly on `mode` and bail if
    // it's missing — falling through to an `else` and reading
    // `data.sessionId.slice(...)` would crash the whole node process.
    const data = client.data as Partial<SocketData> | undefined;
    if (!data?.mode) return;
    if (data.mode === 'staff') {
      this.logger.log(`ws left tenant:${data.tenantSlug}`);
    } else if (data.mode === 'public' && data.orderId) {
      this.logger.log(`ws public left order:${data.orderId.slice(0, 8)}`);
    } else if (data.mode === 'session' && data.sessionId) {
      this.logger.log(`ws session left ${data.sessionId.slice(0, 8)}`);
    }
  }

  emitOrderEvent(tenantId: string, event: string, payload: unknown) {
    this.server.to(`tenant:${tenantId}`).emit(event, payload);
    const p = payload as { id?: string; guestSessionId?: string | null } | undefined;
    if (p?.id) {
      this.server.to(`order:${p.id}`).emit(event, payload);
    }
    if (p?.guestSessionId) {
      this.server.to(`session:${p.guestSessionId}`).emit(event, payload);
    }
  }

  emitTenantEvent(tenantId: string, event: string, payload: unknown) {
    this.server.to(`tenant:${tenantId}`).emit(event, payload);
  }

  emitSessionEvent(sessionId: string, event: string, payload: unknown) {
    this.server.to(`session:${sessionId}`).emit(event, payload);
  }
}
