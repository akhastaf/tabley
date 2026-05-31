import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Query,
  Res,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Response } from 'express';
import { StorageService } from './storage.service';

/**
 * Public, read-only proxy for objects in the (private) bucket.
 *
 * Railway object-storage buckets are private, so the browser can't load images
 * directly. Uploaded assets are stored as `…/v1/files?key=<key>` URLs (see
 * StorageService.publicUrl) and this controller streams the bytes back using
 * the server's credentials.
 *
 * The key is passed as a query param rather than a path so object keys that
 * contain slashes (e.g. `menu/<tenant>/<id>.jpg`) work without relying on
 * Express-5 wildcard route matching, which is brittle across versions.
 */
@Controller('files')
export class FilesController {
  constructor(private readonly storage: StorageService) {}

  @Get()
  async serve(@Query('key') key: string | undefined, @Res() res: Response) {
    if (!this.storage.isEnabled()) {
      throw new ServiceUnavailableException({
        code: 'STORAGE_UNAVAILABLE',
        message: 'Object storage is not configured on this server',
      });
    }
    if (!key) {
      throw new BadRequestException({ code: 'KEY_REQUIRED', message: 'key is required' });
    }
    if (!StorageService.isSafeKey(key)) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Not found' });
    }
    let object;
    try {
      object = await this.storage.getObject(key);
    } catch {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Not found' });
    }
    res.setHeader('Content-Type', object.contentType);
    if (object.contentLength !== undefined) {
      res.setHeader('Content-Length', String(object.contentLength));
    }
    if (object.etag) res.setHeader('ETag', object.etag);
    // Uploaded keys carry a random suffix on every change, so the URL itself is
    // the cache-buster — these objects are immutable and safe to cache hard.
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    object.body.pipe(res);
  }
}
