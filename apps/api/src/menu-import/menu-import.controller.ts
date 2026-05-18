import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { UserRole } from '@tabley/shared';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { TenantGuard, TenantRoles } from '../tenant/tenant.guard';
import { CurrentTenant, TenantCtx } from '../tenant/current-tenant.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { MenuImportService } from './menu-import.service';

const uploadSchema = z.object({
  imageBase64: z.string().min(1).max(15_000_000),
  mimeType: z.string().min(1).max(64),
});

@Controller('manage/menu/import')
@UseGuards(AuthGuard, TenantGuard)
@TenantRoles(UserRole.MANAGER, UserRole.PLATFORM_ADMIN)
export class MenuImportController {
  constructor(private readonly service: MenuImportService) {}

  @Post()
  upload(
    @CurrentTenant() t: TenantCtx,
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(uploadSchema)) body: z.infer<typeof uploadSchema>,
  ) {
    return this.service.enqueue(t.id, user.id, body);
  }

  @Get(':id')
  get(@CurrentTenant() t: TenantCtx, @Param('id') id: string) {
    return this.service.getJob(t.id, id);
  }

  @Post(':id/apply')
  apply(@CurrentTenant() t: TenantCtx, @Param('id') id: string) {
    return this.service.apply(t.id, id);
  }
}
