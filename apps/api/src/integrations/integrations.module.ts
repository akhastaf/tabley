import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantEntity } from '@tabley/database';
import { OrdersModule } from '../orders/orders.module';
import { PosOrdersController } from './pos-orders.controller';
import { PosApiKeyGuard } from './pos-api-key.guard';

@Module({
  imports: [TypeOrmModule.forFeature([TenantEntity]), OrdersModule],
  controllers: [PosOrdersController],
  providers: [PosApiKeyGuard],
})
export class IntegrationsModule {}
