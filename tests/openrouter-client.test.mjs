import test from 'node:test';
import assert from 'node:assert/strict';
import { OpenRouterChatError, requestOpenRouter, requestWithSingleFallback } from '../lib/ai/openrouter-client.mjs';
import { DEFAULT_FALLBACK_MODEL, DEFAULT_PRIMARY_MODEL, resolveAIModelConfig } from '../lib/ai/model-config.mjs';
import { acquireChatRequest, deferChatRequest, GENERIC_CHAT_ERROR, chatErrorMessage, prepareChatSubmission, releaseChatRequest, RATE_LIMIT_CHAT_ERROR } from '../lib/chat/submission.mjs';

const inputMessages = [{ role: 'user', content: 'Tell me about this warranty rejection.' }];

function mockResponse(payload, status = 200, headers = {}) {
  return { ok: status >= 200 && status < 300, status, headers: { get: name => headers[name.toLowerCase()] ?? null }, json: async () => payload };
}

function requestOptions(payload, options = {}) {
  return {
    apiKey: 'test-key-not-real',
    model: 'primary-free-test',
    messages: inputMessages,
    logger: null,
    fetchImpl: async () => mockResponse(payload, options.status ?? 200),
  };
}

test('configured default models are fixed free text-chat variants', () => {
  assert.equal(DEFAULT_PRIMARY_MODEL, 'google/gemma-4-26b-a4b-it:free');
  assert.equal(DEFAULT_FALLBACK_MODEL, 'google/gemma-4-31b-it:free');
  assert.match(DEFAULT_PRIMARY_MODEL, /:free$/);
  assert.match(DEFAULT_FALLBACK_MODEL, /:free$/);
  assert.notEqual(DEFAULT_PRIMARY_MODEL, DEFAULT_FALLBACK_MODEL);
  assert.equal(DEFAULT_PRIMARY_MODEL, resolveAIModelConfig({}).primaryModel);
  assert.equal(DEFAULT_FALLBACK_MODEL, resolveAIModelConfig({}).fallbackModel);
  assert.deepEqual(resolveAIModelConfig({ AI_MODEL: 'custom/primary', AI_FALLBACK_MODEL: 'custom/fallback' }), {
    primaryModel: 'custom/primary',
    fallbackModel: 'custom/fallback',
  });
  assert.doesNotMatch(`${DEFAULT_PRIMARY_MODEL} ${DEFAULT_FALLBACK_MODEL}`, /llama-3\.3|openrouter\/free/);
});

test('accepts a normal non-empty text completion through chat/completions', async () => {
  let requestUrl;
  let requestBody;
  const result = await requestOpenRouter({
    ...requestOptions({ model: 'provider/model', choices: [{ message: { role: 'assistant', content: 'A complete answer.' }, finish_reason: 'stop' }] }),
    fetchImpl: async (url, init) => { requestUrl = url; requestBody = JSON.parse(init.body); return mockResponse({ model: 'provider/model', choices: [{ message: { role: 'assistant', content: 'A complete answer.' }, finish_reason: 'stop' }] }); },
  });
  assert.equal(requestUrl, 'https://openrouter.ai/api/v1/chat/completions');
  assert.equal(requestBody.model, 'primary-free-test');
  assert.equal(result.content, 'A complete answer.');
  assert.equal(result.model, 'provider/model');
});

test('accepts text alongside reasoning metadata but never returns or logs reasoning content', async () => {
  const logs = [];
  const result = await requestOpenRouter({
    ...requestOptions({ choices: [{ message: { content: 'User-facing answer.', reasoning: 'PRIVATE_REASONING_SECRET', reasoning_details: [{ type: 'reasoning.text', text: 'PRIVATE_REASONING_SECRET' }] }, finish_reason: 'stop' }] }),
    logger: { info: (...args) => logs.push(args), error: (...args) => logs.push(args) },
  });
  assert.equal(result.content, 'User-facing answer.');
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_REASONING_SECRET/);
  assert.doesNotMatch(JSON.stringify(logs), /PRIVATE_REASONING_SECRET/);
  assert.match(JSON.stringify(logs), /reasoningPresent/);
});

test('null content with reasoning and tool calls produces no user-facing text', async () => {
  const logs = [];
  await assert.rejects(requestOpenRouter({
    ...requestOptions({ model: 'reasoning/model', choices: [{ message: { content: null, reasoning: 'PRIVATE_REASONING_SECRET', tool_calls: [{ function: { name: 'search', arguments: 'PRIVATE_TOOL_ARGUMENTS' } }] }, finish_reason: 'stop' }] }),
    logger: { error: (...args) => logs.push(args) },
  }), error => error.code === 'NO_USER_TEXT' && error.retryable);
  const diagnostics = JSON.stringify(logs);
  assert.match(diagnostics, /reasoningPresent/);
  assert.match(diagnostics, /toolCallsCount/);
  assert.doesNotMatch(diagnostics, /PRIVATE_REASONING_SECRET|PRIVATE_TOOL_ARGUMENTS/);
});

test('uses an explicit refusal string as user-facing text without exposing reasoning', async () => {
  const result = await requestOpenRouter(requestOptions({ choices: [{ message: { content: null, reasoning: 'PRIVATE_REASONING_SECRET', refusal: 'I cannot help with that request.' }, finish_reason: 'stop' }] }));
  assert.equal(result.content, 'I cannot help with that request.');
  assert.doesNotMatch(result.content, /PRIVATE_REASONING_SECRET/);
});

test('length finish_reason is an incomplete completion eligible for one fallback', async () => {
  await assert.rejects(requestOpenRouter(requestOptions({ choices: [{ message: { content: 'This is a partial response' }, finish_reason: 'length' }] })), error => error.code === 'INCOMPLETE_COMPLETION' && error.retryable);
});

test('empty choices are treated as a retryable unusable completion', async () => {
  await assert.rejects(requestOpenRouter(requestOptions({ model: 'empty/model', choices: [] })), error => error.code === 'EMPTY_CHOICES' && error.retryable);
});

test('primary HTTP 429 uses its configured fallback once and succeeds on fallback HTTP 200', async () => {
  const attempted = [];
  const result = await requestWithSingleFallback({
    primaryModel: 'primary-free-test', fallbackModel: 'fallback-free-test',
    request: model => {
      attempted.push(model);
      const primary = model === 'primary-free-test';
      return requestOpenRouter({
        ...requestOptions(primary
          ? { error: { code: 'rate_limit_exceeded', message: 'Too many requests' } }
          : { model, choices: [{ message: { content: 'Fallback answer.' }, finish_reason: 'stop' }] },
        { status: primary ? 429 : 200, headers: primary ? { 'retry-after': '7' } : {} }),
        model,
        fetchImpl: async () => mockResponse(primary
          ? { error: { code: 'rate_limit_exceeded', message: 'Too many requests' } }
          : { model, choices: [{ message: { content: 'Fallback answer.' }, finish_reason: 'stop' }] }, primary ? 429 : 200,
        primary ? { 'retry-after': '7' } : {}),
      });
    },
  });
  assert.deepEqual(attempted, ['primary-free-test', 'fallback-free-test']);
  assert.equal(result.content, 'Fallback answer.');
});

test('primary and fallback HTTP 429 stop after one fallback and preserve Retry-After', async () => {
  const attempted = [];
  await assert.rejects(requestWithSingleFallback({
    primaryModel: 'primary-free-test', fallbackModel: 'fallback-free-test',
    request: model => {
      attempted.push(model);
      return requestOpenRouter({
        ...requestOptions({ error: { code: 'rate_limit_exceeded', message: 'Too many requests' } }, { status: 429 }),
        model,
        fetchImpl: async () => mockResponse({ error: { code: 'rate_limit_exceeded', message: 'Too many requests' } }, 429, { 'retry-after': model === 'primary-free-test' ? '4' : '12' }),
      });
    },
  }), error => error.code === 'RATE_LIMITED' && error.status === 429 && error.retryAfterSeconds === 12);
  assert.deepEqual(attempted, ['primary-free-test', 'fallback-free-test']);
  assert.equal(chatErrorMessage('RATE_LIMITED'), 'The AI service is currently busy. Please wait a little and try again.');
});

test('primary HTTP 200 succeeds without requesting fallback', async () => {
  const attempted = [];
  const result = await requestWithSingleFallback({
    primaryModel: 'primary-free-test', fallbackModel: 'fallback-free-test',
    request: model => {
      attempted.push(model);
      return requestOpenRouter({ ...requestOptions({ choices: [{ message: { content: 'Primary answer.' }, finish_reason: 'stop' }] }), model });
    },
  });
  assert.deepEqual(attempted, ['primary-free-test']);
  assert.equal(result.content, 'Primary answer.');
});

test('a primary no-text failure retries once using the fallback model', async () => {
  const attempts = [];
  const answer = await requestWithSingleFallback({
    primaryModel: 'primary-free-test',
    fallbackModel: 'fallback-free-test',
    request: async model => {
      attempts.push(model);
      if (model === 'primary-free-test') return requestOpenRouter(requestOptions({ choices: [{ message: { content: null, reasoning: 'hidden' }, finish_reason: 'stop' }] }));
      return requestOpenRouter({ ...requestOptions({ model, choices: [{ message: { content: 'Fallback answer.' }, finish_reason: 'stop' }] }), model });
    },
  });
  assert.deepEqual(attempts, ['primary-free-test', 'fallback-free-test']);
  assert.equal(answer.content, 'Fallback answer.');
});

test('both models failing reject instead of reporting success, with only one fallback attempt', async () => {
  const attempts = [];
  await assert.rejects(requestWithSingleFallback({
    primaryModel: 'primary', fallbackModel: 'fallback',
    request: async model => { attempts.push(model); throw new OpenRouterChatError('No text.', { code: 'NO_USER_TEXT', retryable: true }); },
  }), error => error.code === 'NO_USER_TEXT');
  assert.deepEqual(attempts, ['primary', 'fallback']);
});

test('authentication failures are permanent and do not call the fallback', async () => {
  const attempts = [];
  await assert.rejects(requestWithSingleFallback({
    primaryModel: 'primary', fallbackModel: 'fallback',
    request: async model => {
      attempts.push(model);
      return requestOpenRouter(requestOptions({ error: { code: 'invalid_api_key', message: 'Unauthorized' } }, { status: 401 }));
    },
  }), error => error.code === 'PROVIDER_ERROR' && !error.retryable);
  assert.deepEqual(attempts, ['primary']);
});

test('retrying a failed user submission keeps one displayed and requested user message', () => {
  const first = prepareChatSubmission([{ role: 'assistant', content: 'Welcome' }], 'Prepare a formal complaint letter for me.');
  const displayed = [{ role: 'assistant', content: 'Welcome' }, ...first.messages];
  const retry = prepareChatSubmission(displayed, 'Prepare a formal complaint letter for me.', true);
  assert.equal(first.shouldAppendUserTurn, true);
  assert.equal(retry.shouldAppendUserTurn, false);
  assert.equal(retry.messages.filter(message => message.role === 'user').length, 1);
});

test('rapid retry clicks create only one new request and honor server retry delay', () => {
  const gate = { inFlight: false, nextAllowedAt: 0 };
  let requests = 0;
  assert.equal(acquireChatRequest(gate, 1000), true);
  requests++;
  assert.equal(acquireChatRequest(gate, 1001), false);
  releaseChatRequest(gate);
  assert.equal(acquireChatRequest(gate, 1500), false);
  deferChatRequest(gate, 12, 1500);
  assert.equal(acquireChatRequest(gate, 12999), false);
  assert.equal(acquireChatRequest(gate, 13500), true);
  requests++;
  releaseChatRequest(gate);
  assert.equal(requests, 2);
  assert.equal(RATE_LIMIT_CHAT_ERROR, 'The AI service is currently busy. Please wait a little and try again.');
});

test('unexpected frontend chat errors use the simple generic message', () => {
  assert.equal(GENERIC_CHAT_ERROR, 'Something went wrong. Please try again.');
  assert.equal(chatErrorMessage('CHAT_FAILED'), 'Something went wrong. Please try again.');
  assert.equal(chatErrorMessage(undefined), 'Something went wrong. Please try again.');
});
