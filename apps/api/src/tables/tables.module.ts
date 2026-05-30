import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RestaurantTableEntity, TenantEntity, TenantMemberEntity } from '@tabley/database';
import { TablesController } from './tables.controller';
import { TablesService } from './tables.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([RestaurantTableEntity, TenantEntity, TenantMemberEntity]),
  ],
  controllers: [TablesController],
  providers: [TablesService],
  exports: [TablesService],
})
export class TablesModule {}
