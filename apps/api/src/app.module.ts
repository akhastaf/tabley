import { Module } from '@nestjs/common';
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
} from '@tabley/database';
import { HealthModule } from './health/health.module';
import { RealtimeModule } from './realtime/realtime.module';

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
      ],
      synchronize: false,
      autoLoadEntities: false,
    }),
    BullModule.forRoot({
      connection: { url: process.env.REDIS_URL ?? 'redis://localhost:6379' },
    }),
    HealthModule,
    RealtimeModule,
  ],
})
export class AppModule {}
