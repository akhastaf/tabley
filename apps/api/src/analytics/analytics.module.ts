import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  OrderEntity,
  OrderLineEntity,
  RestaurantTableEntity,
  TableSessionEntity,
} from '@tabley/database';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrderEntity,
      OrderLineEntity,
      RestaurantTableEntity,
      TableSessionEntity,
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
