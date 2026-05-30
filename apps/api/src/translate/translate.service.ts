import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';

const GEMINI_MODEL = process.env.MENU_TRANSLATE_MODEL ?? 'gemini-2.5-flash-lite';
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
  error?: { message?: string };
}

/**
 * Thin wrapper over Gemini's REST API (no SDK dependency — uses global fetch).
 * Translates batches of short menu strings into a target language. The model
 * is `gemini-2.5-flash-lite` by default, overridable via MENU_TRANSLATE_MODEL.
 */
@Injectable()
export class TranslateService {
  private readonly logger = new Logger(TranslateService.name);

  isEnabled(): boolean {
    return Boolean(process.env.GEMINI_API_KEY);
  }

  /**
   * Translate `texts` from `sourceLanguage` into `targetLanguage`. Returns an
   * array the same length and order as the input. Empty strings pass through
   * untouched (and are never sent to the model).
   */
  async translateBatch(
    texts: string[],
    targetLanguage: string,
    sourceLanguage?: string,
  ): Promise<string[]> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new ServiceUnavailableException({
        code: 'TRANSLATE_DISABLED',
        message: 'Translation is not configured (GEMINI_API_KEY missing)',
      });
    }

    // Only send the non-empty entries; remember their positions to merge back.
    const payload: { index: number; text: string }[] = [];
    texts.forEach((text, index) => {
      if (text && text.trim().length > 0) payload.push({ index, text });
    });
    if (payload.length === 0) return [...texts];

    const from = sourceLanguage ? ` from ${sourceLanguage}` : '';
    const systemPrompt =
      `You are a professional translator for restaurant menus. Translate each string` +
      `${from} into ${targetLanguage}. Keep translations concise and natural for a menu.` +
      ` Preserve well-known dish proper nouns when a local audience would expect them.` +
      ` Do not add notes, quotes, or extra punctuation. Return a JSON array of strings` +
      ` with EXACTLY ${payload.length} elements, in the same order as the input.`;

    const userText = JSON.stringify(payload.map((p) => p.text));

    let res: Response;
    try {
      res = await fetch(
        `${GEMINI_ENDPOINT}/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: 'user', parts: [{ text: userText }] }],
            generationConfig: {
              temperature: 0.2,
              responseMimeType: 'application/json',
              responseSchema: { type: 'ARRAY', items: { type: 'STRING' } },
            },
          }),
        },
      );
    } catch (err) {
      this.logger.error(`Gemini request failed: ${(err as Error).message}`);
      throw new ServiceUnavailableException({
        code: 'TRANSLATE_FAILED',
        message: 'Translation service is unreachable',
      });
    }

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as GeminiResponse | null;
      const detail = body?.error?.message ?? `HTTP ${res.status}`;
      this.logger.error(`Gemini error: ${detail}`);
      throw new ServiceUnavailableException({
        code: 'TRANSLATE_FAILED',
        message: `Translation failed: ${detail}`,
      });
    }

    const data = (await res.json()) as GeminiResponse;
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) {
      throw new ServiceUnavailableException({
        code: 'TRANSLATE_FAILED',
        message: 'Translation returned no content',
      });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new ServiceUnavailableException({
        code: 'TRANSLATE_FAILED',
        message: 'Translation returned malformed output',
      });
    }
    if (!Array.isArray(parsed) || parsed.length !== payload.length) {
      throw new ServiceUnavailableException({
        code: 'TRANSLATE_FAILED',
        message: 'Translation length mismatch',
      });
    }

    // Merge translated values back into the original positions.
    const out = [...texts];
    payload.forEach((p, i) => {
      const value = parsed[i];
      out[p.index] = typeof value === 'string' ? value : (texts[p.index] ?? '');
    });
    return out;
  }
}
