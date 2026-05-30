import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@tabley/shared';
import { AuthGuard } from '../auth/auth.guard';
import { TenantGuard, TenantRoles } from '../tenant/tenant.guard';
import { CurrentTenant, TenantCtx } from '../tenant/current-tenant.decorator';
import { AnalyticsService } from './analytics.service';

const MAX_RANGE_DAYS = 366;

function parseDate(value: string | undefined, fallback: Date): Date {
  if (!value) return fallback;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException({ code: 'BAD_DATE', message: `Invalid date: ${value}` });
  }
  return d;
}

@Controller('manage/analytics')
@UseGuards(AuthGuard, TenantGuard)
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  /** Live operational snapshot — visible to everyone working the floor. */
  @Get('overview')
  @TenantRoles(
    UserRole.MANAGER,
    UserRole.WAITER,
    UserRole.KITCHEN,
    UserRole.CASHIER,
    UserRole.PLATFORM_ADMIN,
  )
  overview(@CurrentTenant() t: TenantCtx) {
    return this.service.overview(t.id);
  }

  /** Period KPIs with a comparison window — manager-only. */
  @Get('kpis')
  @TenantRoles(UserRole.MANAGER, UserRole.PLATFORM_ADMIN)
  kpis(
    @CurrentTenant() t: TenantCtx,
    @Query('from') fromQ?: string,
    @Query('to') toQ?: string,
    @Query('compareFrom') compareFromQ?: string,
    @Query('compareTo') compareToQ?: string,
  ) {
    const now = new Date();
    const defaultFrom = new Date(now.getTime() - 7 * 86_400_000);
    const from = parseDate(fromQ, defaultFrom);
    const to = parseDate(toQ, now);
    if (from >= to) {
      throw new BadRequestException({ code: 'BAD_RANGE', message: '`from` must be before `to`' });
    }
    const span = to.getTime() - from.getTime();
    if (span > MAX_RANGE_DAYS * 86_400_000) {
      throw new BadRequestException({ code: 'RANGE_TOO_LARGE', message: 'Range exceeds one year' });
    }
    // Default comparison: the equally-sized window immediately before `from`.
    const compareTo = parseDate(compareToQ, from);
    const compareFrom = parseDate(compareFromQ, new Date(from.getTime() - span));
    return this.service.kpis(t.id, from, to, compareFrom, compareTo);
  }
}
