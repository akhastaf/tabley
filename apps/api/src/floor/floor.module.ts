import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  OrderEntity,
  RestaurantTableEntity,
  TableSessionEntity,
  TableSessionParticipantEntity,
} from '@tabley/database';
import { FloorController } from './floor.controller';
import { FloorService } from './floor.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RestaurantTableEntity,
      TableSessionEntity,
      TableSessionParticipantEntity,
      OrderEntity,
    ]),
  ],
  controllers: [FloorController],
  providers: [FloorService],
})
export class FloorModule {}
