import type { ExtractedMenuDraft } from '@tabley/database';
import { extractMenuWithClaude } from './claude-extractor';
import { extractMenuWithGemini } from './gemini-extractor';

const DEFAULT_MODEL = 'gemini-2.5-flash-lite';

/**
 * Dispatcher used by the menu-import processor. The actual backend is chosen
 * by the model id in `MENU_INGEST_MODEL`:
 *   - `gemini-*`            → Google Gemini via REST (GEMINI_API_KEY)
 *   - everything else       → Anthropic Claude SDK   (ANTHROPIC_API_KEY)
 *
 * Default is `gemini-2.5-flash-lite` — cheapest path that still handles
 * multi-page menu photos well. Override by setting `MENU_INGEST_MODEL` in the
 * environment (docker-compose loads it from `.env`).
 */
export async function extractMenuFromImage(args: {
  imageBase64: string;
  mimeType: string;
}): Promise<{ result: ExtractedMenuDraft; modelUsed: string }> {
  const model = process.env.MENU_INGEST_MODEL?.trim() || DEFAULT_MODEL;
  if (model.startsWith('gemini-')) {
    return extractMenuWithGemini({ ...args, model });
  }
  return extractMenuWithClaude({ ...args, model });
}
