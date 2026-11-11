const TRUNCATION_REASONS = new Set(['length', 'max_tokens', 'max_output_tokens', 'token_limit']);

export function isTruncatedFinishReason(reason) {
  if (typeof reason !== 'string') return false;
  const normalized = reason.toLowerCase().replace(/[ -]/g, '_');
  return TRUNCATION_REASONS.has(normalized) || /token.*limit|limit.*token/.test(normalized);
}
