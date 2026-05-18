import { z } from 'zod';

export const moneySchema = z.number().int().nonnegative();

export const menuCategorySchema = z.object({
  name: z.string().min(1).max(80),
  position: z.number().int().nonnegative().default(0),
});
export type MenuCategoryInput = z.infer<typeof menuCategorySchema>;

export const menuItemSchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  priceCents: moneySchema,
  imageUrl: z.string().url().optional(),
  allergens: z.array(z.string()).default([]),
  available: z.boolean().default(true),
  position: z.number().int().nonnegative().default(0),
});
export type MenuItemInput = z.infer<typeof menuItemSchema>;

export const aiMenuIngestSchema = z.object({
  source: z.enum(['image', 'pdf']),
  fileKey: z.string().min(1),
});
export type AiMenuIngestInput = z.infer<typeof aiMenuIngestSchema>;
