import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  RestaurantTableEntity,
  TableSessionEntity,
  TableSessionParticipantEntity,
  TenantEntity,
} from '@tabley/database';
import { RealtimeModule } from '../realtime/realtime.module';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TableSessionEntity,
      TableSessionParticipantEntity,
      RestaurantTableEntity,
      TenantEntity,
    ]),
    RealtimeModule,
  ],
  providers: [SessionsService],
  controllers: [SessionsController],
  exports: [SessionsService],
})
export class SessionsModule {}
