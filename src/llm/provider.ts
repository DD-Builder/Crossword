/** Provider-agnostic chat completion. One `complete()` call; adapters for
 * Anthropic, OpenAI, Gemini, xAI (Grok), and any OpenAI-compatible custom
 * endpoint. The user supplies their own key in Settings. */

import type { LlmConfig } from '../storage/settings.ts';

export interface CompletionRequest {
  system: string;
  user: string;
  json: boolean;
  maxTokens: number;
}

const DEFAULT_MODELS: Record<LlmConfig['provider'], string> = {
  anthropic: 'claude-sonnet-4-5',
  openai: 'gpt-4o-mini',
  gemini: 'gemini-2.0-flash',
  xai: 'grok-3-mini',
  custom: '',
};

export function defaultModel(provider: LlmConfig['provider']): string {
  return DEFAULT_MODELS[provider];
}

async function post(url: string, headers: Record<string, string>, body: unknown): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Provider error ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function anthropic(req: CompletionRequest, cfg: LlmConfig): Promise<string> {
  const data = (await post(
    'https://api.anthropic.com/v1/messages',
    {
      'x-api-key': cfg.apiKey,
      'anthropic-version': '2023-06-01',
      // Required for browser (CORS) calls to the Anthropic API.
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    {
      model: cfg.model || DEFAULT_MODELS.anthropic,
      max_tokens: req.maxTokens,
      system: req.system,
      messages: [{ role: 'user', content: req.user }],
    },
  )) as { content?: { type: string; text?: string }[] };
  const text = data.content?.find((b) => b.type === 'text')?.text;
  if (!text) throw new Error('Empty Anthropic response');
  return text;
}

async function openaiCompatible(req: CompletionRequest, cfg: LlmConfig, baseUrl: string, model: string): Promise<string> {
  const data = (await post(
    `${baseUrl.replace(/\/$/, '')}/chat/completions`,
    { authorization: `Bearer ${cfg.apiKey}` },
    {
      model,
      max_tokens: req.maxTokens,
      ...(req.json ? { response_format: { type: 'json_object' } } : {}),
      messages: [
        { role: 'system', content: req.system },
        { role: 'user', content: req.user },
      ],
    },
  )) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('Empty completion response');
  return text;
}

async function gemini(req: CompletionRequest, cfg: LlmConfig): Promise<string> {
  const model = cfg.model || DEFAULT_MODELS.gemini;
  const data = (await post(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    { 'x-goog-api-key': cfg.apiKey },
    {
      systemInstruction: { parts: [{ text: req.system }] },
      contents: [{ role: 'user', parts: [{ text: req.user }] }],
      generationConfig: {
        maxOutputTokens: req.maxTokens,
        ...(req.json ? { responseMimeType: 'application/json' } : {}),
      },
    },
  )) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('');
  if (!text) throw new Error('Empty Gemini response');
  return text;
}

export async function complete(req: CompletionRequest, cfg: LlmConfig): Promise<string> {
  switch (cfg.provider) {
    case 'anthropic':
      return anthropic(req, cfg);
    case 'openai':
      return openaiCompatible(req, cfg, 'https://api.openai.com/v1', cfg.model || DEFAULT_MODELS.openai);
    case 'xai':
      return openaiCompatible(req, cfg, 'https://api.x.ai/v1', cfg.model || DEFAULT_MODELS.xai);
    case 'gemini':
      return gemini(req, cfg);
    case 'custom': {
      if (!cfg.baseUrl) throw new Error('Custom provider needs a base URL');
      if (!cfg.model) throw new Error('Custom provider needs a model name');
      return openaiCompatible(req, cfg, cfg.baseUrl, cfg.model);
    }
  }
}

/** Cheap connectivity probe for the Settings "Test connection" button. */
export async function testConnection(cfg: LlmConfig): Promise<void> {
  await complete({ system: 'Reply with the word: ok', user: 'ping', json: false, maxTokens: 8 }, cfg);
}
