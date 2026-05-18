import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { DataSource, Repository } from 'typeorm';
import {
  ExtractedMenuDraft,
  MenuCategoryEntity,
  MenuImportJobEntity,
  MenuItemEntity,
} from '@tabley/database';
import { SearchSync } from '../search/search.sync';
import { MENU_IMPORT_QUEUE } from './constants';

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const SUPPORTED = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
]);

interface UploadInput {
  imageBase64: string;
  mimeType: string;
}

@Injectable()
export class MenuImportService {
  private readonly logger = new Logger(MenuImportService.name);

  constructor(
    @InjectRepository(MenuImportJobEntity)
    private readonly jobs: Repository<MenuImportJobEntity>,
    @InjectRepository(MenuCategoryEntity)
    private readonly categories: Repository<MenuCategoryEntity>,
    @InjectRepository(MenuItemEntity)
    private readonly items: Repository<MenuItemEntity>,
    @InjectQueue(MENU_IMPORT_QUEUE) private readonly queue: Queue,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly searchSync: SearchSync,
  ) {}

  async enqueue(tenantId: string, userId: string, input: UploadInput) {
    if (!SUPPORTED.has(input.mimeType)) {
      throw new BadRequestException({
        code: 'UNSUPPORTED_MEDIA',
        message: 'Upload a JPEG, PNG, WebP, GIF, or PDF',
      });
    }
    const decoded = Buffer.from(input.imageBase64, 'base64');
    if (decoded.byteLength === 0) {
      throw new BadRequestException({ code: 'EMPTY_FILE', message: 'Upload is empty' });
    }
    if (decoded.byteLength > MAX_BYTES) {
      throw new BadRequestException({ code: 'FILE_TOO_LARGE', message: 'Max 8 MB' });
    }

    const job = await this.jobs.save(
      this.jobs.create({
        tenantId,
        createdByUserId: userId,
        sourceType: input.mimeType === 'application/pdf' ? 'pdf' : 'image',
        mimeType: input.mimeType,
        status: 'queued',
      }),
    );

    await this.queue.add(
      'extract-menu',
      {
        tenantId,
        importId: job.id,
        imageBase64: input.imageBase64,
        mimeType: input.mimeType,
      },
      { removeOnComplete: 100, removeOnFail: 100, attempts: 1 },
    );
    return job;
  }

  async getJob(tenantId: string, id: string) {
    const row = await this.jobs.findOne({ where: { id, tenantId } });
    if (!row) throw new NotFoundException({ code: 'JOB_NOT_FOUND', message: 'Not found' });
    return row;
  }

  async apply(tenantId: string, id: string) {
    const job = await this.getJob(tenantId, id);
    if (job.status !== 'completed' || !job.result) {
      throw new ConflictException({
        code: 'JOB_NOT_READY',
        message: 'Job has not produced a result yet',
      });
    }
    if (job.appliedAt) {
      throw new ConflictException({
        code: 'JOB_ALREADY_APPLIED',
        message: 'This draft has already been applied',
      });
    }

    const summary = await this.dataSource.transaction(async (m) => {
      const catRepo = m.getRepository(MenuCategoryEntity);
      const itemRepo = m.getRepository(MenuItemEntity);
      const positionStart = await catRepo.count({ where: { tenantId } });
      let createdCategories = 0;
      let createdItems = 0;

      for (let i = 0; i < job.result!.categories.length; i++) {
        const draftCat = job.result!.categories[i]!;
        const cat = await catRepo.save(
          catRepo.create({
            tenantId,
            name: draftCat.name.slice(0, 80),
            position: positionStart + i,
          }),
        );
        createdCategories++;

        for (let j = 0; j < draftCat.items.length; j++) {
          const di = draftCat.items[j]!;
          await itemRepo.save(
            itemRepo.create({
              tenantId,
              categoryId: cat.id,
              name: di.name.slice(0, 120),
              description: di.description ?? null,
              priceCents: di.priceCents,
              allergens: di.allergens ?? [],
              available: true,
              position: j,
            }),
          );
          createdItems++;
        }
      }

      return { createdCategories, createdItems };
    });

    job.appliedAt = new Date();
    await this.jobs.save(job);

    // Best-effort: index the newly created items.
    try {
      await this.searchSync.reindexTenant(tenantId);
    } catch {
      // ignore — search is non-critical
    }

    return { ...summary, appliedAt: job.appliedAt };
  }

  async markProcessing(id: string) {
    await this.jobs.update({ id }, { status: 'processing' });
  }

  async markCompleted(id: string, result: ExtractedMenuDraft, modelUsed: string) {
    await this.jobs.update({ id }, { status: 'completed', result, modelUsed });
  }

  async markFailed(id: string, error: string) {
    await this.jobs.update({ id }, { status: 'failed', errorMessage: error.slice(0, 1000) });
  }

  async getTenantIdForJob(id: string) {
    const row = await this.jobs.findOne({ where: { id } });
    return row?.tenantId ?? null;
  }
}
