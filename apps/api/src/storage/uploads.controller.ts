import {
  BadRequestException,
  Body,
  Controller,
  Post,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { StorageService } from './storage.service';

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB after base64 decode

const uploadSchema = z.object({
  dataUrl: z.string().min(1).max(3_500_000),
});

@Controller('uploads')
@UseGuards(AuthGuard)
export class UploadsController {
  constructor(private readonly storage: StorageService) {}

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
