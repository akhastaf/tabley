import { Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@tabley/shared';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { TenantGuard, TenantRoles } from '../tenant/tenant.guard';
import { CurrentTenant, TenantCtx } from '../tenant/current-tenant.decorator';
import { OrdersService } from './orders.service';

@Controller('manage/orders')
@UseGuards(AuthGuard, TenantGuard)
@TenantRoles(UserRole.MANAGER, UserRole.WAITER, UserRole.KITCHEN, UserRole.PLATFORM_ADMIN)
export class ManageOrdersController {
  constructor(private readonly service: OrdersService) {}

  @Get()
  list(@CurrentTenant() t: TenantCtx, @Query('status') status?: string) {
    return this.service.listForTenant(t.id, status);
  }

  @Patch(':id/confirm')
  confirm(
    @CurrentTenant() t: TenantCtx,
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.service.confirm(t.id, id, user.id);
  }

  @Patch(':id/ready')
  ready(
    @CurrentTenant() t: TenantCtx,
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.service.markReady(t.id, id, user.id);
  }

  @Patch(':id/served')
  served(
    @CurrentTenant() t: TenantCtx,
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.service.markServed(t.id, id, user.id);
  }

  @Patch(':id/paid')
  paid(
    @CurrentTenant() t: TenantCtx,
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.service.markPaid(t.id, id, user.id);
  }

  @Patch(':id/cancel')
  cancel(
    @CurrentTenant() t: TenantCtx,
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.service.cancel(t.id, id, user.id);
  }
}
