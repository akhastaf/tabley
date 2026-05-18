import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@tabley/shared';
import { AuthGuard } from '../auth/auth.guard';
import { TenantGuard, TenantRoles } from '../tenant/tenant.guard';
import { CurrentTenant, TenantCtx } from '../tenant/current-tenant.decorator';
import { SearchService } from './search.service';
import { SearchSync } from './search.sync';

@Controller('manage/search')
@UseGuards(AuthGuard, TenantGuard)
@TenantRoles(
  UserRole.MANAGER,
  UserRole.WAITER,
  UserRole.KITCHEN,
  UserRole.CASHIER,
  UserRole.PLATFORM_ADMIN,
)
export class SearchController {
  constructor(
    private readonly service: SearchService,
    private readonly sync: SearchSync,
  ) {}

  @Get('menu')
  search(@CurrentTenant() t: TenantCtx, @Query('q') q?: string) {
    return this.service.search({ tenantId: t.id, q: q ?? '' });
  }

  @Post('menu/reindex')
  reindex(@CurrentTenant() t: TenantCtx) {
    return this.sync.reindexTenant(t.id);
  }
}
