import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import {
  TenantEntity,
  TenantMemberEntity,
  RestaurantTableEntity,
  MenuCategoryEntity,
  MenuItemEntity,
  OrderEntity,
  OrderLineEntity,
  PaymentEntity,
  MenuImportJobEntity,
  TenantInvitationEntity,
} from '@tabley/database';
import { HealthModule } from './health/health.module';
import { RealtimeModule } from './realtime/realtime.module';
import { TenantsModule } from './tenants/tenants.module';
import { MenuModule } from './menu/menu.module';
import { TablesModule } from './tables/tables.module';
import { OrdersModule } from './orders/orders.module';
import { MenuImportModule } from './menu-import/menu-import.module';
import { InvitationsModule } from './invitations/invitations.module';
import { SearchModule } from './search/search.module';
import { AdminModule } from './admin/admin.module';
import { SessionMiddleware } from './auth/session.middleware';
import { TenantMiddleware } from './tenant/tenant.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: [
        TenantEntity,
        TenantMemberEntity,
        RestaurantTableEntity,
        MenuCategoryEntity,
        MenuItemEntity,
        OrderEntity,
        OrderLineEntity,
        PaymentEntity,
        MenuImportJobEntity,
        TenantInvitationEntity,
      ],
      synchronize: false,
      autoLoadEntities: false,
    }),
    TypeOrmModule.forFeature([TenantEntity, TenantMemberEntity]),
    BullModule.forRoot({
      connection: { url: process.env.REDIS_URL ?? 'redis://localhost:6379' },
    }),
    HealthModule,
    RealtimeModule,
    TenantsModule,
    MenuModule,
    TablesModule,
    OrdersModule,
    MenuImportModule,
    InvitationsModule,
    SearchModule,
    AdminModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(SessionMiddleware, TenantMiddleware).forRoutes('{*path}');
  }
}
