import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { menuCategorySchema, menuItemSchema, UserRole } from '@tabley/shared';
import { AuthGuard } from '../auth/auth.guard';
import { TenantGuard, TenantRoles } from '../tenant/tenant.guard';
import { CurrentTenant, TenantCtx } from '../tenant/current-tenant.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { MenuService } from './menu.service';

@Controller('manage/menu')
@UseGuards(AuthGuard, TenantGuard)
@TenantRoles(UserRole.MANAGER, UserRole.PLATFORM_ADMIN)
export class ManageMenuController {
  constructor(private readonly service: MenuService) {}

  @Get('categories')
  listCategories(@CurrentTenant() t: TenantCtx) {
    return this.service.listCategories(t.id);
  }

  @Post('categories')
  createCategory(
    @CurrentTenant() t: TenantCtx,
    @Body(new ZodValidationPipe(menuCategorySchema)) body: z.infer<typeof menuCategorySchema>,
  ) {
    return this.service.createCategory(t.id, body);
  }

  @Delete('categories/:id')
  async deleteCategory(@CurrentTenant() t: TenantCtx, @Param('id') id: string) {
    await this.service.deleteCategory(t.id, id);
    return { ok: true };
  }

  @Get('items')
  listItems(@CurrentTenant() t: TenantCtx) {
    return this.service.listItems(t.id);
  }

  @Post('items')
  createItem(
    @CurrentTenant() t: TenantCtx,
    @Body(new ZodValidationPipe(menuItemSchema)) body: z.infer<typeof menuItemSchema>,
  ) {
    return this.service.createItem(t.id, body);
  }

  @Delete('items/:id')
  async deleteItem(@CurrentTenant() t: TenantCtx, @Param('id') id: string) {
    await this.service.deleteItem(t.id, id);
    return { ok: true };
  }
}
