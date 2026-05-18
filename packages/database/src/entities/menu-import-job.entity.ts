import { Column, Entity, Index } from 'typeorm';
import { TenantScopedEntity } from './_base';

@Entity({ name: 'menu_import_jobs' })
export class MenuImportJobEntity extends TenantScopedEntity {
  @Index()
  @Column({ name: 'created_by_user_id', type: 'varchar', length: 64 })
  createdByUserId!: string;

  @Column({ name: 'source_type', type: 'varchar', length: 16 })
  sourceType!: 'image' | 'pdf';

  @Column({ name: 'mime_type', type: 'varchar', length: 64 })
  mimeType!: string;

  @Index()
  @Column({ type: 'varchar', length: 24 })
  status!: 'queued' | 'processing' | 'completed' | 'failed';

  @Column({ name: 'model_used', type: 'varchar', length: 64, nullable: true })
  modelUsed!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  result!: ExtractedMenuDraft | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage!: string | null;

  @Column({ name: 'applied_at', type: 'timestamptz', nullable: true })
  appliedAt!: Date | null;
}

export interface ExtractedMenuItemDraft {
  name: string;
  description?: string;
  priceCents: number;
  allergens?: string[];
}

export interface ExtractedMenuCategoryDraft {
  name: string;
  items: ExtractedMenuItemDraft[];
}

export interface ExtractedMenuDraft {
  currency: string;
  categories: ExtractedMenuCategoryDraft[];
}
