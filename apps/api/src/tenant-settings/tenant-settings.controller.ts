import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { UserRole } from '@tabley/shared';
import { AuthGuard } from '../auth/auth.guard';
import { TenantGuard, TenantRoles } from '../tenant/tenant.guard';
import { CurrentTenant, TenantCtx } from '../tenant/current-tenant.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { TenantSettingsService } from './tenant-settings.service';

const patchSchema = z.object({
  deliveryEnabled: z.boolean().optional(),
  defaultLocale: z.string().min(2).max(8).optional(),
  posWebhookEnabled: z.boolean().optional(),
  posWebhookUrl: z.string().url().max(2048).nullable().optional(),
  regenerateWebhookSecret: z.boolean().optional(),
  regeneratePosApiKey: z.boolean().optional(),
  revokePosApiKey: z.boolean().optional(),
});

@Controller('manage/settings')
@UseGuards(AuthGuard, TenantGuard)
@TenantRoles(UserRole.MANAGER, UserRole.PLATFORM_ADMIN)
export class TenantSettingsController {
  constructor(private readonly service: TenantSettingsService) {}

  @Get()
  get(@CurrentTenant() t: TenantCtx) {
    return this.service.get(t.id);
  }

  @Patch()
  patch(
    @CurrentTenant() t: TenantCtx,
    @Body(new ZodValidationPipe(patchSchema)) body: z.infer<typeof patchSchema>,
  ) {
    return this.service.patch(t.id, body);
  }
}
