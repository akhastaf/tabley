import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AuthGuard } from '../auth/auth.guard';
import { PlatformAdminGuard } from '../auth/platform-admin.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AdminService } from './admin.service';

const updateTenantSchema = z.object({
  isActive: z.boolean().optional(),
  plan: z.string().min(1).max(32).optional(),
  deliveryEnabled: z.boolean().optional(),
});

@Controller('admin')
@UseGuards(AuthGuard, PlatformAdminGuard)
export class AdminController {
  constructor(private readonly service: AdminService) {}

  @Get('stats')
  stats() {
    return this.service.stats();
  }

  @Get('tenants')
  listTenants(@Query('q') q?: string) {
    return this.service.listTenants(q);
  }

  @Get('tenants/:id')
  getTenant(@Param('id') id: string) {
    return this.service.getTenant(id);
  }

  @Patch('tenants/:id')
  updateTenant(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateTenantSchema)) body: z.infer<typeof updateTenantSchema>,
  ) {
    return this.service.updateTenant(id, body);
  }
}
