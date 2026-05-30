import type { ExtractedMenuDraft } from '@tabley/database';

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  error?: { message?: string };
}

// Gemini's responseSchema is a subset of OpenAPI: types are uppercase strings,
// objects need `properties` + `required`, arrays need `items`. We mirror the
// Anthropic tool schema so the extracted draft matches `ExtractedMenuDraft`.
const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    currency: {
      type: 'STRING',
      description: 'ISO 4217 currency code visible on the menu (USD, EUR, MAD, GBP, etc.).',
    },
    categories: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING', description: 'Category heading as it appears on the menu.' },
          items: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                name: { type: 'STRING' },
                description: { type: 'STRING' },
                priceCents: {
                  type: 'INTEGER',
                  description:
                    'Price in minor units (cents/centimes). Multiply visible price by 100. Skip the item if no price is visible.',
                },
                allergens: {
                  type: 'ARRAY',
                  items: { type: 'STRING' },
                  description:
                    'Allergens or dietary tags explicitly listed on the menu (gluten, milk, nuts, vegan, etc.). Omit if none are stated.',
                },
              },
              required: ['name', 'priceCents'],
            },
          },
        },
        required: ['name', 'items'],
      },
    },
  },
  required: ['currency', 'categories'],
};

const SYSTEM_PROMPT = `You are an expert at digitizing restaurant menus from photos and PDFs.
- Read every line of the menu carefully.
- Preserve the original category order.
- Convert each visible price to integer cents (e.g. 4.50 -> 450, 12 -> 1200).
- If a price is missing or unclear, skip that item rather than guessing.
- Use the exact item name and short descriptions as printed. Do not invent items.
- Allergens are only included if explicitly stated on the menu (e.g. "(contains nuts)", "V", "GF").
Return ONLY the structured JSON that matches the response schema.`;

/**
 * Extract a menu from an image (or PDF) using Google Gemini. We talk to the
 * REST API directly with global `fetch` — same pattern as TranslateService, no
 * SDK dependency. Model defaults to `gemini-2.5-flash-lite`; override via
 * `MENU_INGEST_MODEL`.
 */
export async function extractMenuWithGemini(args: {
  imageBase64: string;
  mimeType: string;
  model: string;
}): Promise<{ result: ExtractedMenuDraft; modelUsed: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  const res = await fetch(
    `${GEMINI_ENDPOINT}/${encodeURIComponent(args.model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [
          {
            role: 'user',
            parts: [
              { inline_data: { mime_type: args.mimeType, data: args.imageBase64 } },
              { text: 'Extract this menu and return the structured JSON.' },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
        },
      }),
    },
  );

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as GeminiResponse | null;
    const detail = body?.error?.message ?? `HTTP ${res.status}`;
    throw new Error(`Gemini menu extraction failed: ${detail}`);
  }

  const data = (await res.json()) as GeminiResponse;
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) {
    throw new Error('Gemini returned no content');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Gemini returned malformed JSON');
  }

  // Light shape check — protects the apply() step from a model that ignored
  // the schema. The processor catches and marks the job failed if this throws.
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    typeof (parsed as { currency?: unknown }).currency !== 'string' ||
    !Array.isArray((parsed as { categories?: unknown }).categories)
  ) {
    throw new Error('Gemini result missing currency or categories');
  }

  return { result: parsed as ExtractedMenuDraft, modelUsed: args.model };
}
