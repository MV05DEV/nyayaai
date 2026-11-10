export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

export interface AIProvider {
  chat(messages: AIMessage[], options?: { temperature?: number; maxTokens?: number }): Promise<AIResponse>;
}

class OpenRouterProvider implements AIProvider {
  private apiKey: string;
  private model: string;
  private baseUrl = 'https://openrouter.ai/api/v1';

  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY || '';
    this.model = process.env.AI_MODEL || 'google/gemini-flash-1.5';
  }

  async chat(messages: AIMessage[], options: { temperature?: number; maxTokens?: number } = {}): Promise<AIResponse> {
    if (!this.apiKey || this.apiKey === 'your-openrouter-api-key-here') {
      throw new Error('OPENROUTER_API_KEY is not configured. Please set it in your .env file.');
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': 'NyayaAI Legal Assistant',
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxTokens ?? 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error (${response.status}): ${error}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    
    if (!choice?.message?.content) {
      throw new Error('Invalid response from AI provider');
    }

    return {
      content: choice.message.content,
      model: data.model || this.model,
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
      } : undefined,
    };
  }
}

let providerInstance: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (!providerInstance) {
    providerInstance = new OpenRouterProvider();
  }
  return providerInstance;
}
