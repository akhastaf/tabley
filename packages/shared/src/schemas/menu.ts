import { z } from 'zod';
import { MENU_LABELS } from '../enums';

export const moneySchema = z.number().int().nonnegative();

export const menuLabelSchema = z.enum(
  MENU_LABELS as [string, ...string[]],
);

// Every nutrition field is optional — restaurants fill in only what they have.
// Amounts are stored in their natural unit (kcal, grams, milligrams).
export const nutritionSchema = z.object({
  caloriesKcal: z.number().int().nonnegative().optional(),
  proteinG: z.number().nonnegative().optional(),
  carbsG: z.number().nonnegative().optional(),
  fatG: z.number().nonnegative().optional(),
  sugarG: z.number().nonnegative().optional(),
  sodiumMg: z.number().nonnegative().optional(),
  servingSize: z.string().max(40).optional(),
});
export type NutritionInfo = z.infer<typeof nutritionSchema>;

export const menuCategorySchema = z.object({
  name: z.string().min(1).max(80),
  position: z.number().int().nonnegative().default(0),
});
export type MenuCategoryInput = z.infer<typeof menuCategorySchema>;

// --- Multi-language menu ---

// Per-language overlay shapes. Keys are language codes (e.g. 'it', 'darija').
export const menuItemTranslationSchema = z.object({
  name: z.string().max(120).optional(),
  description: z.string().max(2000).optional(),
});
export const menuItemTranslationsSchema = z.record(z.string(), menuItemTranslationSchema);
export type MenuItemTranslationsInput = z.infer<typeof menuItemTranslationsSchema>;

export const menuCategoryTranslationSchema = z.object({
  name: z.string().max(80).optional(),
});
export const menuCategoryTranslationsSchema = z.record(
  z.string(),
  menuCategoryTranslationSchema,
);
export type MenuCategoryTranslationsInput = z.infer<typeof menuCategoryTranslationsSchema>;

// A language a restaurant offers for its menu.
export const menuLanguageSchema = z.object({
  code: z.string().min(1).max(16),
  name: z.string().min(1).max(40),
});
export type MenuLanguage = z.infer<typeof menuLanguageSchema>;

// Manager adds a language by display name; the server derives a stable code.
export const addMenuLanguageSchema = z.object({
  name: z.string().min(1).max(40),
});
export type AddMenuLanguageInput = z.infer<typeof addMenuLanguageSchema>;

// Trigger AI translation of the whole menu (or one item) into a language.
export const translateRequestSchema = z.object({
  code: z.string().min(1).max(16),
});
export type TranslateRequestInput = z.infer<typeof translateRequestSchema>;

export const menuItemSchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  priceCents: moneySchema,
  imageUrl: z.string().url().optional(),
  allergens: z.array(z.string()).default([]),
  labels: z.array(menuLabelSchema).default([]),
  nutrition: nutritionSchema.nullable().optional(),
  available: z.boolean().default(true),
  position: z.number().int().nonnegative().default(0),
});
export type MenuItemInput = z.infer<typeof menuItemSchema>;

/**
 * Partial-update schema for menu items. Every field is optional; passing
 * `imageUrl: null` clears the image, `description: null` clears the
 * description. `categoryId` is allowed so an item can be moved between
 * categories.
 */
export const menuItemUpdateSchema = z
  .object({
    categoryId: z.string().uuid().optional(),
    name: z.string().min(1).max(120).optional(),
    description: z.string().max(2000).nullable().optional(),
    priceCents: moneySchema.optional(),
    imageUrl: z.string().url().nullable().optional(),
    allergens: z.array(z.string()).optional(),
    labels: z.array(menuLabelSchema).optional(),
    nutrition: nutritionSchema.nullable().optional(),
    available: z.boolean().optional(),
    position: z.number().int().nonnegative().optional(),
    translations: menuItemTranslationsSchema.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });
export type MenuItemUpdateInput = z.infer<typeof menuItemUpdateSchema>;

export const menuCategoryUpdateSchema = z
  .object({
    name: z.string().min(1).max(80).optional(),
    position: z.number().int().nonnegative().optional(),
    translations: menuCategoryTranslationsSchema.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });
export type MenuCategoryUpdateInput = z.infer<typeof menuCategoryUpdateSchema>;

export const aiMenuIngestSchema = z.object({
  source: z.enum(['image', 'pdf']),
  fileKey: z.string().min(1),
});
export type AiMenuIngestInput = z.infer<typeof aiMenuIngestSchema>;
