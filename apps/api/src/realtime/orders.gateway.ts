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
import { TenantEntity, TenantMemberEntity } from '@tabley/database';
import { auth } from '../auth/auth';

interface SocketData {
  userId: string;
  tenantId: string;
  tenantSlug: string;
  role: string;
}

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
  ) {}

  async handleConnection(client: Socket) {
    try {
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

      const data: SocketData = {
        userId: session.user.id,
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        role: member.role,
      };
      client.data = data;
      await client.join(`tenant:${tenant.id}`);
      this.logger.log(`ws joined tenant:${tenant.slug} as ${member.role} (user ${session.user.id})`);
    } catch (err) {
      this.logger.error(`ws handshake failed: ${(err as Error).message}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const data = client.data as SocketData | undefined;
    if (data?.tenantSlug) {
      this.logger.log(`ws left tenant:${data.tenantSlug}`);
    }
  }

  emitOrderEvent(tenantId: string, event: string, payload: unknown) {
    this.server.to(`tenant:${tenantId}`).emit(event, payload);
  }
}
