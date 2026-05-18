import { Module } from '@nestjs/common';
import { OrdersGateway } from './orders.gateway';

@Module({ providers: [OrdersGateway] })
export class RealtimeModule {}
