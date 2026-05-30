import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { UserRole } from '@tabley/shared';
import { AuthGuard } from '../auth/auth.guard';
import { TenantGuard, TenantRoles } from '../tenant/tenant.guard';
import { CurrentTenant, TenantCtx } from '../tenant/current-tenant.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { TablesService } from './tables.service';

const createTableSchema = z.object({
  label: z.string().min(1).max(40),
  capacity: z.number().int().positive().max(40).optional(),
});

const assignSchema = z.object({
  // null clears the assignment (table falls back to unzoned waiters).
  waiterId: z.string().min(1).max(64).nullable(),
});

@Controller('manage/tables')
@UseGuards(AuthGuard, TenantGuard)
@TenantRoles(UserRole.MANAGER, UserRole.PLATFORM_ADMIN)
export class TablesController {
  constructor(private readonly service: TablesService) {}

  @Get()
  list(@CurrentTenant() t: TenantCtx) {
    return this.service.list(t.id);
  }

  @Post()
  create(
    @CurrentTenant() t: TenantCtx,
    @Body(new ZodValidationPipe(createTableSchema)) body: z.infer<typeof createTableSchema>,
  ) {
    return this.service.create(t.id, body);
  }

  @Post(':id/rotate')
  rotate(@CurrentTenant() t: TenantCtx, @Param('id') id: string) {
    return this.service.rotateToken(t.id, id);
  }

  @Patch(':id/assignee')
  assign(
    @CurrentTenant() t: TenantCtx,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(assignSchema)) body: z.infer<typeof assignSchema>,
  ) {
    return this.service.setAssignee(t.id, id, body.waiterId);
  }

  @Delete(':id')
  async remove(@CurrentTenant() t: TenantCtx, @Param('id') id: string) {
    await this.service.remove(t.id, id);
    return { ok: true };
  }
}
