import 'server-only';
import Anthropic from '@anthropic-ai/sdk';

let client: Anthropic | null = null;

export function anthropic() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set');
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

export const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5';
