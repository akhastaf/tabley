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
    const deviceId = String(client.handshake.auth?.deviceId ?? '');
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
    const data = client.data as SocketData | undefined;
    if (!data) return;
    if (data.mode === 'staff') {
      this.logger.log(`ws left tenant:${data.tenantSlug}`);
    } else if (data.mode === 'public') {
      this.logger.log(`ws public left order:${data.orderId.slice(0, 8)}`);
    } else {
      this.logger.log(`ws session left ${data.sessionId.slice(0, 8)}`);
    }
  }

  emitOrderEvent(tenantId: string, event: string, payload: unknown) {
    this.server.to(`tenant:${tenantId}`).emit(event, payload);
    const orderId = (payload as { id?: string } | undefined)?.id;
    if (orderId) {
      this.server.to(`order:${orderId}`).emit(event, payload);
    }
  }

  emitTenantEvent(tenantId: string, event: string, payload: unknown) {
    this.server.to(`tenant:${tenantId}`).emit(event, payload);
  }

  emitSessionEvent(sessionId: string, event: string, payload: unknown) {
    this.server.to(`session:${sessionId}`).emit(event, payload);
  }
}
