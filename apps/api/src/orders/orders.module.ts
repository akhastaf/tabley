import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  MenuItemEntity,
  OrderEntity,
  OrderLineEntity,
  RestaurantTableEntity,
  TenantEntity,
} from '@tabley/database';
import { RealtimeModule } from '../realtime/realtime.module';
import { TablesModule } from '../tables/tables.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { ManageOrdersController } from './manage-orders.controller';
import { PublicOrdersController } from './public-orders.controller';
import { MeOrdersController } from './me-orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrderEntity,
      OrderLineEntity,
      MenuItemEntity,
      RestaurantTableEntity,
      TenantEntity,
    ]),
    TablesModule,
    RealtimeModule,
    WebhooksModule,
  ],
  controllers: [ManageOrdersController, PublicOrdersController, MeOrdersController],
  providers: [OrdersService],
  exports: [OrdersService, TypeOrmModule],
})
export class OrdersModule {}
