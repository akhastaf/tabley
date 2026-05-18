import Anthropic from '@anthropic-ai/sdk';
import type { ExtractedMenuDraft } from '@tabley/database';

const MODEL = process.env.MENU_INGEST_MODEL ?? 'claude-sonnet-4-6';
const MAX_TOKENS = 4096;

const SUBMIT_TOOL = {
  name: 'submit_menu',
  description:
    'Submit the full menu you extracted from the image. Use this once with the final structured payload.',
  input_schema: {
    type: 'object' as const,
    properties: {
      currency: {
        type: 'string',
        description: 'ISO 4217 currency code visible on the menu (USD, EUR, MAD, GBP, etc.).',
      },
      categories: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Category heading as it appears on the menu.' },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  description: {
                    type: 'string',
                    description: 'Short item description if present, otherwise omit.',
                  },
                  priceCents: {
                    type: 'integer',
                    description:
                      'Price in minor units (cents/centimes). Multiply visible price by 100. If the price has decimals, parse them. Skip the item if no price is visible.',
                  },
                  allergens: {
                    type: 'array',
                    items: { type: 'string' },
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
  },
};

const SYSTEM_PROMPT = `You are an expert at digitizing restaurant menus from photos and PDFs.
- Read every line of the menu carefully.
- Preserve the original category order.
- Convert each visible price to integer cents (e.g. 4.50 -> 450, 12 -> 1200).
- If a price is missing or unclear, skip that item rather than guessing.
- Use the exact item name and short descriptions as printed. Do not invent items.
- Allergens are only included if explicitly stated on the menu (e.g. "(contains nuts)", "V", "GF").
Call the submit_menu tool exactly once with the final result.`;

export async function extractMenuFromImage(args: {
  imageBase64: string;
  mimeType: string;
}): Promise<{ result: ExtractedMenuDraft; modelUsed: string }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set');
  }
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const media = args.mimeType === 'application/pdf' ? 'document' : 'image';

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    tools: [SUBMIT_TOOL],
    tool_choice: { type: 'tool', name: 'submit_menu' },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: media,
            source: {
              type: 'base64',
              media_type: args.mimeType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' | 'application/pdf',
              data: args.imageBase64,
            },
          } as never,
          {
            type: 'text',
            text: 'Extract this menu and call submit_menu with the result.',
          },
        ],
      },
    ],
  });

  const toolUse = response.content.find((b) => b.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error('Model did not call submit_menu');
  }
  return {
    result: toolUse.input as ExtractedMenuDraft,
    modelUsed: response.model,
  };
}
