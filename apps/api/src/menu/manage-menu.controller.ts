import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import {
  addMenuLanguageSchema,
  menuCategorySchema,
  menuCategoryUpdateSchema,
  menuItemSchema,
  menuItemUpdateSchema,
  translateRequestSchema,
  UserRole,
} from '@tabley/shared';
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

  @Patch('categories/:id')
  updateCategory(
    @CurrentTenant() t: TenantCtx,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(menuCategoryUpdateSchema))
    body: z.infer<typeof menuCategoryUpdateSchema>,
  ) {
    return this.service.updateCategory(t.id, id, body);
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

  @Patch('items/:id')
  updateItem(
    @CurrentTenant() t: TenantCtx,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(menuItemUpdateSchema))
    body: z.infer<typeof menuItemUpdateSchema>,
  ) {
    return this.service.updateItem(t.id, id, body);
  }

  @Delete('items/:id')
  async deleteItem(@CurrentTenant() t: TenantCtx, @Param('id') id: string) {
    await this.service.deleteItem(t.id, id);
    return { ok: true };
  }

  // --- Multi-language ---

  @Get('languages')
  listLanguages(@CurrentTenant() t: TenantCtx) {
    return this.service.listLanguages(t.id);
  }

  @Post('languages')
  addLanguage(
    @CurrentTenant() t: TenantCtx,
    @Body(new ZodValidationPipe(addMenuLanguageSchema))
    body: z.infer<typeof addMenuLanguageSchema>,
  ) {
    return this.service.addLanguage(t.id, body.name);
  }

  @Delete('languages/:code')
  removeLanguage(@CurrentTenant() t: TenantCtx, @Param('code') code: string) {
    return this.service.removeLanguage(t.id, code);
  }

  /** AI-translate the entire menu into the given language. */
  @Post('translate')
  translateMenu(
    @CurrentTenant() t: TenantCtx,
    @Body(new ZodValidationPipe(translateRequestSchema))
    body: z.infer<typeof translateRequestSchema>,
  ) {
    return this.service.translateMenu(t.id, body.code);
  }

  /** AI-translate a single item into the given language. */
  @Post('items/:id/translate')
  translateItem(
    @CurrentTenant() t: TenantCtx,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(translateRequestSchema))
    body: z.infer<typeof translateRequestSchema>,
  ) {
    return this.service.translateItem(t.id, id, body.code);
  }
}
