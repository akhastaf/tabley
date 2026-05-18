import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { TenantsService } from './tenants.service';

const createTenantSchema = z.object({
  slug: z.string().min(3).max(62),
  name: z.string().min(1).max(160),
});

@Controller('tenants')
@UseGuards(AuthGuard)
export class TenantsController {
  constructor(private readonly service: TenantsService) {}

  @Get('mine')
  list(@CurrentUser() user: { id: string }) {
    return this.service.listForUser(user.id);
  }

  @Post()
  create(
    @Body(new ZodValidationPipe(createTenantSchema)) body: z.infer<typeof createTenantSchema>,
    @CurrentUser() user: { id: string },
  ) {
    return this.service.create(body, user.id);
  }
}
