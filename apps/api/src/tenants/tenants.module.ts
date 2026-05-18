import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantEntity, TenantMemberEntity } from '@tabley/database';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';

@Module({
  imports: [TypeOrmModule.forFeature([TenantEntity, TenantMemberEntity])],
  controllers: [TenantsController],
  providers: [TenantsService],
})
export class TenantsModule {}
