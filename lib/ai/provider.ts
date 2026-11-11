import { isTruncatedFinishReason } from './completion-status.mjs';
import { OpenRouterChatError, requestOpenRouter, requestWithSingleFallback } from './openrouter-client.mjs';
import { resolveAIModelConfig } from './model-config.mjs';

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  content: string;
  model: string;
  finishReason?: string | null;
  truncated?: boolean;
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

export interface AIProvider {
  chat(messages: AIMessage[], options?: { temperature?: number; maxTokens?: number }): Promise<AIResponse>;
}

class OpenRouterProvider implements AIProvider {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly fallbackModel: string;
  private readonly baseUrl = 'https://openrouter.ai/api/v1';

  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY || '';
    const models = resolveAIModelConfig();
    this.model = models.primaryModel;
    this.fallbackModel = models.fallbackModel;
  }

  async chat(messages: AIMessage[], options: { temperature?: number; maxTokens?: number } = {}): Promise<AIResponse> {
    if (!this.apiKey || this.apiKey === 'your-openrouter-api-key-here') {
      throw new OpenRouterChatError('OpenRouter is not configured.', { code: 'API_KEY_MISSING' });
    }

    const logger = process.env.NODE_ENV === 'production' ? null : console;
    const result = await requestWithSingleFallback({
      primaryModel: this.model,
      fallbackModel: this.fallbackModel,
      logger,
      request: model => requestOpenRouter({
        apiKey: this.apiKey,
        model,
        messages,
        temperature: options.temperature ?? 0.3,
        maxTokens: options.maxTokens ?? 2000,
        baseUrl: this.baseUrl,
        appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        logger,
      }),
    });

    return { ...result, truncated: isTruncatedFinishReason(result.finishReason) };
  }
}

let providerInstance: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (!providerInstance) providerInstance = new OpenRouterProvider();
  return providerInstance;
}
