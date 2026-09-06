import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CompleteResult, isTimeoutError, parseJsonContent } from './ai.types';

@Injectable()
export class AiClient {
  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.config.get<string>('ai.apiKey'));
  }

  async completeJson(
    systemPrompt: string,
    userPrompt: string,
  ): Promise<CompleteResult> {
    const apiKey = this.config.get<string>('ai.apiKey') ?? '';
    if (!apiKey) {
      return { ok: false, reason: 'missing_key' };
    }

    const baseUrl = (
      this.config.get<string>('ai.baseUrl') ?? 'https://api.openai.com/v1'
    ).replace(/\/$/, '');
    const model = this.config.get<string>('ai.model') ?? 'gpt-4o-mini';
    const timeoutMs = this.config.get<number>('ai.timeoutMs') ?? 15000;

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (response.status === 429) {
        return { ok: false, reason: 'rate_limit' };
      }
      if (!response.ok) {
        return { ok: false, reason: 'provider_error' };
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const data = parseJsonContent(payload.choices?.[0]?.message?.content);
      if (data === undefined) {
        return { ok: false, reason: 'invalid_response' };
      }
      return { ok: true, data };
    } catch (error) {
      if (isTimeoutError(error)) {
        return { ok: false, reason: 'timeout' };
      }
      return { ok: false, reason: 'provider_error' };
    }
  }
}
