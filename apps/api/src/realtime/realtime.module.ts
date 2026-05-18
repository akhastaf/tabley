import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantEntity, TenantMemberEntity } from '@tabley/database';
import { OrdersGateway } from './orders.gateway';

@Module({
  imports: [TypeOrmModule.forFeature([TenantEntity, TenantMemberEntity])],
  providers: [OrdersGateway],
  exports: [OrdersGateway],
})
export class RealtimeModule {}
