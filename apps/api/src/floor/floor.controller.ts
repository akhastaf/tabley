import { Controller, Get, UseGuards } from '@nestjs/common';
import { UserRole } from '@tabley/shared';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { TenantGuard, TenantRoles } from '../tenant/tenant.guard';
import { CurrentTenant, TenantCtx } from '../tenant/current-tenant.decorator';
import { FloorService } from './floor.service';

@Controller('manage/floor')
@UseGuards(AuthGuard, TenantGuard)
@TenantRoles(
  UserRole.MANAGER,
  UserRole.WAITER,
  UserRole.KITCHEN,
  UserRole.CASHIER,
  UserRole.PLATFORM_ADMIN,
)
export class FloorController {
  constructor(private readonly service: FloorService) {}

  @Get()
  list(@CurrentTenant() t: TenantCtx, @CurrentUser() user: { id: string }) {
    return this.service.list(t.id, { role: t.role, userId: user.id });
  }
}
