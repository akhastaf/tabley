import {
  BadRequestException,
  Body,
  Controller,
  Param,
  Post,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@tabley/shared';
import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { TenantGuard, TenantRoles } from '../tenant/tenant.guard';
import { CurrentTenant, TenantCtx } from '../tenant/current-tenant.decorator';
import { MenuService } from '../menu/menu.service';
import { StorageService } from './storage.service';

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB after base64 decode
// Menu item photos can carry a bit more detail than avatars; allow 4 MB
// post-decode (~5.5 MB base64) so a phone snap from a manager doesn't get
// rejected before we even see it.
const MENU_MAX_BYTES = 4 * 1024 * 1024;

const uploadSchema = z.object({
  dataUrl: z.string().min(1).max(3_500_000),
});
const menuUploadSchema = z.object({
  dataUrl: z.string().min(1).max(6_000_000),
});

@Controller('uploads')
@UseGuards(AuthGuard)
export class UploadsController {
  constructor(
    private readonly storage: StorageService,
    private readonly menu: MenuService,
  ) {}

  @Post('avatar')
  async avatar(
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(uploadSchema)) body: z.infer<typeof uploadSchema>,
  ) {
    if (!this.storage.isEnabled()) {
      throw new ServiceUnavailableException({
        code: 'STORAGE_UNAVAILABLE',
        message: 'Object storage is not configured on this server',
      });
    }
    let buffer: Buffer;
    let mimeType: string;
    try {
      ({ buffer, mimeType } = StorageService.decodeDataUrl(body.dataUrl));
    } catch (err) {
      throw new BadRequestException({
        code: 'INVALID_UPLOAD',
        message: (err as Error).message,
      });
    }
    if (buffer.byteLength > MAX_BYTES) {
      throw new BadRequestException({
        code: 'FILE_TOO_LARGE',
        message: `Max ${Math.floor(MAX_BYTES / 1024)} KB`,
      });
    }
    const ext = extFor(mimeType);
    const key = `avatars/${user.id}-${randomBytes(8).toString('hex')}.${ext}`;
    const url = await this.storage.put(key, buffer, mimeType);
    return { url, key };
  }

  /**
   * Upload the restaurant's logo. Tenant-scoped (manager only). Returns the
   * public URL; the caller persists it via PATCH /v1/manage/settings so this
   * endpoint stays decoupled from the tenant repository (same pattern as
   * avatar uploads).
   */
  @Post('logo')
  @UseGuards(TenantGuard)
  @TenantRoles(UserRole.MANAGER, UserRole.PLATFORM_ADMIN)
  async logo(
    @CurrentTenant() tenant: TenantCtx,
    @Body(new ZodValidationPipe(uploadSchema)) body: z.infer<typeof uploadSchema>,
  ) {
    if (!this.storage.isEnabled()) {
      throw new ServiceUnavailableException({
        code: 'STORAGE_UNAVAILABLE',
        message: 'Object storage is not configured on this server',
      });
    }
    let buffer: Buffer;
    let mimeType: string;
    try {
      ({ buffer, mimeType } = StorageService.decodeDataUrl(body.dataUrl));
    } catch (err) {
      throw new BadRequestException({
        code: 'INVALID_UPLOAD',
        message: (err as Error).message,
      });
    }
    if (buffer.byteLength > MAX_BYTES) {
      throw new BadRequestException({
        code: 'FILE_TOO_LARGE',
        message: `Max ${Math.floor(MAX_BYTES / 1024)} KB`,
      });
    }
    const ext = extFor(mimeType);
    const key = `logos/${tenant.id}-${randomBytes(8).toString('hex')}.${ext}`;
    const url = await this.storage.put(key, buffer, mimeType);
    return { url, key };
  }

  /**
   * Upload an image for a menu item. Tenant-scoped: the request must carry
   * `x-tenant-slug` and the caller must be a manager of that tenant.
   * MenuService.setItemImage verifies the item belongs to the tenant before
   * persisting, so the param `id` cannot be used to clobber another
   * tenant's item even if guessed.
   */
  @Post('menu-item/:id')
  @UseGuards(TenantGuard)
  @TenantRoles(UserRole.MANAGER, UserRole.PLATFORM_ADMIN)
  async menuItemImage(
    @CurrentTenant() tenant: TenantCtx,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(menuUploadSchema)) body: z.infer<typeof menuUploadSchema>,
  ) {
    if (!this.storage.isEnabled()) {
      throw new ServiceUnavailableException({
        code: 'STORAGE_UNAVAILABLE',
        message: 'Object storage is not configured on this server',
      });
    }
    let buffer: Buffer;
    let mimeType: string;
    try {
      ({ buffer, mimeType } = StorageService.decodeDataUrl(body.dataUrl));
    } catch (err) {
      throw new BadRequestException({
        code: 'INVALID_UPLOAD',
        message: (err as Error).message,
      });
    }
    if (buffer.byteLength > MENU_MAX_BYTES) {
      throw new BadRequestException({
        code: 'FILE_TOO_LARGE',
        message: `Max ${Math.floor(MENU_MAX_BYTES / 1024)} KB`,
      });
    }
    const ext = extFor(mimeType);
    // Random suffix on every upload so replacing an image busts CDN caches
    // without needing a separate purge step.
    const key = `menu/${tenant.id}/${id}-${randomBytes(8).toString('hex')}.${ext}`;
    const url = await this.storage.put(key, buffer, mimeType);
    // setItemImage will 404 if the item id doesn't belong to this tenant,
    // which is the tenant-isolation check.
    await this.menu.setItemImage(tenant.id, id, url);
    return { url, key };
  }
}

function extFor(mimeType: string): string {
  switch (mimeType) {
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    case 'image/jpeg':
    default:
      return 'jpg';
  }
}
