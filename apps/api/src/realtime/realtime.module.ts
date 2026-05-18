import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  OrderEntity,
  RestaurantTableEntity,
  TenantEntity,
  TenantMemberEntity,
} from '@tabley/database';
import { OrdersGateway } from './orders.gateway';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TenantEntity,
      TenantMemberEntity,
      OrderEntity,
      RestaurantTableEntity,
    ]),
  ],
  providers: [OrdersGateway],
  exports: [OrdersGateway],
})
export class RealtimeModule {}
