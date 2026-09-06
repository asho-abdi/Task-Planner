import { ConfigService } from '@nestjs/config';
import { AiClient } from './ai.client';

describe('AiClient', () => {
  const config = { get: jest.fn() };
  let client: AiClient;
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    config.get.mockImplementation((key: string) => {
      const values: Record<string, string | number> = {
        'ai.apiKey': 'sk-test',
        'ai.baseUrl': 'https://example.test/v1',
        'ai.model': 'test-model',
        'ai.timeoutMs': 15000,
      };
      return values[key];
    });
    client = new AiClient(config as unknown as ConfigService);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('does not call the provider when the API key is missing', async () => {
    config.get.mockImplementation((key: string) =>
      key === 'ai.apiKey' ? '' : 'value',
    );
    const fetchMock = jest.fn();
    global.fetch = fetchMock as typeof fetch;

    const result = await client.completeJson('sys', 'user');

    expect(result).toEqual({ ok: false, reason: 'missing_key' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain('sk-');
  });

  it('maps HTTP 429 to rate_limit', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 429,
      ok: false,
    });

    await expect(client.completeJson('sys', 'user')).resolves.toEqual({
      ok: false,
      reason: 'rate_limit',
    });
  });

  it('maps provider failures and invalid payloads', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 500,
      ok: false,
    });
    await expect(client.completeJson('sys', 'user')).resolves.toEqual({
      ok: false,
      reason: 'provider_error',
    });

    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: () =>
        Promise.resolve({ choices: [{ message: { content: 'not-json' } }] }),
    });
    await expect(client.completeJson('sys', 'user')).resolves.toEqual({
      ok: false,
      reason: 'invalid_response',
    });
  });

  it('maps abort errors to timeout and parses valid JSON', async () => {
    const abort = new Error('Aborted');
    abort.name = 'AbortError';
    global.fetch = jest.fn().mockRejectedValue(abort);
    await expect(client.completeJson('sys', 'user')).resolves.toEqual({
      ok: false,
      reason: 'timeout',
    });

    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: '{"ok":true}' } }],
        }),
    });
    await expect(client.completeJson('sys', 'user')).resolves.toEqual({
      ok: true,
      data: { ok: true },
    });
  });

  it('never puts the API key on the wire in error objects', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 401,
      ok: false,
    });

    const result = await client.completeJson('sys', 'user');
    expect(JSON.stringify(result)).not.toContain('sk-test');
  });
});
