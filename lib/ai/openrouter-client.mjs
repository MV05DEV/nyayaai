const TRANSIENT_STATUSES = new Set([408, 409, 425, 429, 500, 502, 503, 504]);
const AUTH_ERROR_CODES = new Set(['invalid_api_key', 'unauthorized', 'authentication_error', 'insufficient_permissions']);

export class OpenRouterChatError extends Error {
  constructor(message, { code, status = null, retryable = false, providerCode = null, retryAfterSeconds = null } = {}) {
    super(message);
    this.name = 'OpenRouterChatError';
    this.code = code || 'OPENROUTER_ERROR';
    this.status = status;
    this.retryable = retryable;
    this.providerCode = providerCode;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function retryAfterSeconds(response, payload) {
  const header = response.headers?.get?.('retry-after');
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(Math.ceil(seconds), 86400);
    const dateMs = Date.parse(header);
    if (Number.isFinite(dateMs)) return Math.min(Math.max(0, Math.ceil((dateMs - Date.now()) / 1000)), 86400);
  }
  const bodyValue = payload?.error?.metadata?.retry_after ?? payload?.error?.retry_after ?? payload?.retry_after;
  const seconds = typeof bodyValue === 'number' ? bodyValue : typeof bodyValue === 'string' ? Number(bodyValue) : NaN;
  return Number.isFinite(seconds) && seconds >= 0 ? Math.min(Math.ceil(seconds), 86400) : null;
}

function diagnostic(logger, values) {
  logger?.error?.('OpenRouter response diagnostics', values);
}

function providerCode(payload) {
  const code = payload?.error?.code ?? payload?.error?.type;
  return typeof code === 'string' ? code.slice(0, 100) : null;
}

function providerMessage(payload) {
  return typeof payload?.error?.message === 'string' ? payload.error.message : null;
}

function retryableStatus(status, code) {
  const normalized = code?.toLowerCase();
  if (normalized && AUTH_ERROR_CODES.has(normalized)) return false;
  if (normalized && /rate|overload|timeout|unavailable|server_error/.test(normalized)) return true;
  return TRANSIENT_STATUSES.has(status);
}

function textFromContent(content) {
  if (typeof content === 'string') return content.trim();
  if (!Array.isArray(content)) return '';
  return content.map(part => {
    if (typeof part === 'string') return part;
    if (!part || typeof part !== 'object' || part.type !== 'text' || typeof part.text !== 'string') return '';
    return part.text;
  }).join('').trim();
}

function responseMetadata(payload, response, choice, message) {
  const content = message?.content;
  const reasoning = message?.reasoning ?? message?.reasoning_content;
  const reasoningDetails = message?.reasoning_details;
  const tools = message?.tool_calls;
  const refusal = message?.refusal;
  const usage = payload?.usage;
  return {
    httpStatus: response.status,
    responseKeys: payload && typeof payload === 'object' ? Object.keys(payload) : [],
    providerErrorPresent: Boolean(providerMessage(payload)),
    providerErrorCode: providerCode(payload),
    choicesExists: Array.isArray(payload?.choices),
    choicesLength: Array.isArray(payload?.choices) ? payload.choices.length : null,
    messageKeys: message && typeof message === 'object' ? Object.keys(message) : [],
    choiceKeys: choice && typeof choice === 'object' ? Object.keys(choice) : [],
    contentType: content === null ? 'null' : Array.isArray(content) ? 'array' : typeof content,
    contentShape: Array.isArray(content) ? content.map(item => typeof item === 'object' ? item?.type || 'object' : typeof item).slice(0, 8) : null,
    reasoningPresent: reasoning !== undefined && reasoning !== null,
    reasoningType: reasoning === null ? 'null' : typeof reasoning,
    reasoningLength: typeof reasoning === 'string' ? reasoning.length : null,
    reasoningDetailsCount: Array.isArray(reasoningDetails) ? reasoningDetails.length : null,
    reasoningDetailTypes: Array.isArray(reasoningDetails) ? reasoningDetails.map(detail => typeof detail?.type === 'string' ? detail.type : 'unknown').slice(0, 8) : [],
    toolCallsCount: Array.isArray(tools) ? tools.length : 0,
    toolCallTypes: Array.isArray(tools) ? tools.map(tool => typeof tool?.type === 'string' ? tool.type : 'unknown').slice(0, 8) : [],
    refusalPresent: refusal !== undefined && refusal !== null,
    refusalType: refusal === null ? 'null' : typeof refusal,
    refusalLength: typeof refusal === 'string' ? refusal.length : null,
    finishReason: typeof choice?.finish_reason === 'string' ? choice.finish_reason : null,
    incompleteDetailsPresent: payload?.incomplete_details !== undefined,
    incompleteDetailsType: payload?.incomplete_details === null ? 'null' : typeof payload?.incomplete_details,
    reasoningTokens: Number.isFinite(usage?.reasoning_tokens) ? usage.reasoning_tokens : null,
    selectedModel: typeof payload?.model === 'string' ? payload.model : null,
  };
}

export async function requestOpenRouter({
  apiKey,
  model,
  messages,
  temperature = 0.3,
  maxTokens = 2000,
  baseUrl = 'https://openrouter.ai/api/v1',
  appUrl = 'http://localhost:3000',
  fetchImpl = fetch,
  logger = null,
}) {
  let response;
  try {
    response = await fetchImpl(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': appUrl,
        'X-Title': 'NyayaAI Legal Assistant',
      },
      body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
    });
  } catch (cause) {
    diagnostic(logger, { httpStatus: null, failureKind: 'network', errorType: cause instanceof Error ? cause.name : 'unknown', selectedModel: model });
    throw new OpenRouterChatError('OpenRouter request could not reach a provider.', { code: 'NETWORK_ERROR', retryable: true });
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    const retryAfter = retryAfterSeconds(response, null);
    diagnostic(logger, { httpStatus: response.status, failureKind: 'invalid-json', retryAfterSeconds: retryAfter, selectedModel: model });
    throw new OpenRouterChatError('OpenRouter returned an invalid response.', {
      code: response.status === 429 ? 'RATE_LIMITED' : 'INVALID_RESPONSE', status: response.status, retryable: response.ok || TRANSIENT_STATUSES.has(response.status), retryAfterSeconds: retryAfter,
    });
  }

  const choices = Array.isArray(payload?.choices) ? payload.choices : null;
  const choice = choices?.[0];
  const message = choice?.message;
  const metadata = responseMetadata(payload, response, choice, message);
  const errorCode = providerCode(payload);
  const errorText = providerMessage(payload);
  const retryAfter = retryAfterSeconds(response, payload);

  if (!response.ok || errorText) {
    diagnostic(logger, { ...metadata, retryAfterSeconds: retryAfter });
    throw new OpenRouterChatError('OpenRouter rejected the completion request.', {
      code: errorCode?.toLowerCase().includes('rate') || response.status === 429 ? 'RATE_LIMITED' : 'PROVIDER_ERROR',
      status: response.status,
      providerCode: errorCode,
      retryable: retryableStatus(response.status, errorCode),
      retryAfterSeconds: retryAfter,
    });
  }

  if (!choices?.length) {
    diagnostic(logger, { ...metadata, failureKind: 'empty-choices' });
    throw new OpenRouterChatError('OpenRouter returned no completion choices.', { code: 'EMPTY_CHOICES', status: response.status, retryable: true });
  }

  const finishReason = metadata.finishReason;
  if (finishReason && /^(?:length|max_tokens|max_output_tokens|token_limit)$/i.test(finishReason)) {
    diagnostic(logger, { ...metadata, failureKind: 'truncated-completion' });
    throw new OpenRouterChatError('OpenRouter completion was truncated.', { code: 'INCOMPLETE_COMPLETION', status: response.status, retryable: true });
  }

  const contentText = textFromContent(message?.content);
  // `refusal` is intended for the user. Reasoning fields and tool arguments are never user-facing text.
  const refusalText = typeof message?.refusal === 'string' ? message.refusal.trim() : '';
  const content = contentText || refusalText;
  if (!content) {
    diagnostic(logger, { ...metadata, failureKind: 'no-user-facing-text' });
    throw new OpenRouterChatError('OpenRouter completion contained no user-facing text.', { code: 'NO_USER_TEXT', status: response.status, retryable: true });
  }

  logger?.info?.('OpenRouter completion metadata', metadata);
  return {
    content,
    model: metadata.selectedModel || model,
    finishReason,
    usage: payload?.usage ? {
      promptTokens: Number.isFinite(payload.usage.prompt_tokens) ? payload.usage.prompt_tokens : 0,
      completionTokens: Number.isFinite(payload.usage.completion_tokens) ? payload.usage.completion_tokens : 0,
    } : undefined,
  };
}

export async function requestWithSingleFallback({ primaryModel, fallbackModel, request, logger = null }) {
  try {
    return await request(primaryModel);
  } catch (primaryError) {
    if (!(primaryError instanceof OpenRouterChatError) || !primaryError.retryable || !fallbackModel || fallbackModel === primaryModel) {
      throw primaryError;
    }
    logger?.warn?.('Primary OpenRouter model failed; trying configured fallback.', {
      primaryModel,
      fallbackModel,
      code: primaryError.code,
      httpStatus: primaryError.status,
      retryAfterSeconds: primaryError.retryAfterSeconds,
    });
    return request(fallbackModel);
  }
}
