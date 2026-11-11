export const GENERIC_CHAT_ERROR = 'Something went wrong. Please try again.';
export const RATE_LIMIT_CHAT_ERROR = 'The AI service is currently busy. Please wait a little and try again.';

export function acquireChatRequest(gate, now = Date.now(), minimumIntervalMs = 1200) {
  if (gate.inFlight || now < gate.nextAllowedAt) return false;
  gate.inFlight = true;
  gate.nextAllowedAt = now + minimumIntervalMs;
  return true;
}

export function deferChatRequest(gate, seconds, now = Date.now()) {
  if (Number.isFinite(seconds) && seconds >= 0) gate.nextAllowedAt = Math.max(gate.nextAllowedAt, now + Math.ceil(seconds) * 1000);
}

export function releaseChatRequest(gate) {
  gate.inFlight = false;
}

export function prepareChatSubmission(turns, text, retry = false) {
  const history = turns.filter((turn, index) => index > 0 || turn.role !== 'assistant').slice(-48);
  const retryAlreadyDisplayed = retry && history.at(-1)?.role === 'user' && history.at(-1)?.content === text;
  return {
    messages: retryAlreadyDisplayed ? history : [...history, { role: 'user', content: text }],
    shouldAppendUserTurn: !retryAlreadyDisplayed,
  };
}

export function chatErrorMessage(code) {
  return code === 'RATE_LIMITED' ? RATE_LIMIT_CHAT_ERROR : GENERIC_CHAT_ERROR;
}
