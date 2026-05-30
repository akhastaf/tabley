import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { UserRole } from '@tabley/shared';
import { AuthGuard } from '../auth/auth.guard';
import { TenantGuard, TenantRoles } from '../tenant/tenant.guard';
import { CurrentTenant, TenantCtx } from '../tenant/current-tenant.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { TenantSettingsService } from './tenant-settings.service';

const timeRe = /^([01]\d|2[0-3]):([0-5]\d)$/;
const dayHoursSchema = z.object({
  closed: z.boolean(),
  open: z.string().regex(timeRe, 'Use HH:MM 24h'),
  close: z.string().regex(timeRe, 'Use HH:MM 24h'),
});
const openingHoursSchema = z.object({
  mon: dayHoursSchema,
  tue: dayHoursSchema,
  wed: dayHoursSchema,
  thu: dayHoursSchema,
  fri: dayHoursSchema,
  sat: dayHoursSchema,
  sun: dayHoursSchema,
});

const patchSchema = z.object({
  deliveryEnabled: z.boolean().optional(),
  defaultLocale: z.string().min(2).max(8).optional(),
  logoUrl: z.string().url().max(2048).nullable().optional(),
  posWebhookEnabled: z.boolean().optional(),
  posWebhookUrl: z.string().url().max(2048).nullable().optional(),
  regenerateWebhookSecret: z.boolean().optional(),
  regeneratePosApiKey: z.boolean().optional(),
  revokePosApiKey: z.boolean().optional(),
  // Restaurant info — every field nullable so the UI can clear it back out.
  addressLine: z.string().max(255).nullable().optional(),
  city: z.string().max(120).nullable().optional(),
  postalCode: z.string().max(20).nullable().optional(),
  country: z.string().max(80).nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
  email: z.string().email().max(255).nullable().optional(),
  websiteUrl: z.string().url().max(2048).nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  timezone: z.string().min(1).max(64).nullable().optional(),
  openingHours: openingHoursSchema.nullable().optional(),
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
