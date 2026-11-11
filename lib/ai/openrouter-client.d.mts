export type OpenRouterErrorCode = 'NETWORK_ERROR' | 'INVALID_RESPONSE' | 'RATE_LIMITED' | 'PROVIDER_ERROR' | 'EMPTY_CHOICES' | 'INCOMPLETE_COMPLETION' | 'NO_USER_TEXT';
export class OpenRouterChatError extends Error {
  code: OpenRouterErrorCode | string;
  status: number | null;
  retryable: boolean;
  providerCode: string | null;
  retryAfterSeconds: number | null;
  constructor(message: string, options?: { code?: string; status?: number | null; retryable?: boolean; providerCode?: string | null; retryAfterSeconds?: number | null });
}
export function requestOpenRouter(options: {
  apiKey: string;
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  maxTokens?: number;
  baseUrl?: string;
  appUrl?: string;
  fetchImpl?: typeof fetch;
  logger?: Pick<Console, 'error' | 'info' | 'warn'> | null;
}): Promise<{ content: string; model: string; finishReason: string | null; usage?: { promptTokens: number; completionTokens: number } }>;
export function requestWithSingleFallback<T>(options: {
  primaryModel: string;
  fallbackModel: string;
  request: (model: string) => Promise<T>;
  logger?: Pick<Console, 'error' | 'info' | 'warn'> | null;
}): Promise<T>;
