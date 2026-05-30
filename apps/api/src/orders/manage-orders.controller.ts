import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { UserRole } from '@tabley/shared';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { TenantGuard, TenantRoles } from '../tenant/tenant.guard';
import { CurrentTenant, TenantCtx } from '../tenant/current-tenant.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { OrdersService } from './orders.service';

const payBatchSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(50),
});

@Controller('manage/orders')
@UseGuards(AuthGuard, TenantGuard)
@TenantRoles(
  UserRole.MANAGER,
  UserRole.WAITER,
  UserRole.KITCHEN,
  UserRole.CASHIER,
  UserRole.PLATFORM_ADMIN,
)
export class ManageOrdersController {
  constructor(private readonly service: OrdersService) {}

  @Get()
  list(
    @CurrentTenant() t: TenantCtx,
    @CurrentUser() user: { id: string },
    @Query('status') status?: string,
  ) {
    return this.service.listForTenant(t.id, status, { role: t.role, userId: user.id });
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

  @Patch('pay-batch')
  payBatch(
    @CurrentTenant() t: TenantCtx,
    @Body(new ZodValidationPipe(payBatchSchema)) body: z.infer<typeof payBatchSchema>,
  ) {
    return this.service.markManyPaid(t.id, body.ids);
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
