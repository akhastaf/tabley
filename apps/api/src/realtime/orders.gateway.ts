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

type SocketData = StaffSocketData | PublicSocketData;

@WebSocketGateway({
  namespace: '/orders',
  cors: {
    origin: (process.env.API_CORS_ORIGIN ?? 'http://localhost:3000').split(',').map((o) => o.trim()),
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
  ) {}

  async handleConnection(client: Socket) {
    try {
      const mode = String(client.handshake.auth?.mode ?? 'staff');
      if (mode === 'public') {
        return this.connectPublic(client);
      }
      return this.connectStaff(client);
    } catch (err) {
      this.logger.error(`ws handshake failed: ${(err as Error).message}`);
      client.disconnect(true);
    }
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
    } else {
      this.logger.log(`ws public left order:${data.orderId.slice(0, 8)}`);
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
}
