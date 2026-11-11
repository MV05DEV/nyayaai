export const DEFAULT_PRIMARY_MODEL = 'google/gemma-4-26b-a4b-it:free';
export const DEFAULT_FALLBACK_MODEL = 'google/gemma-4-31b-it:free';

export function resolveAIModelConfig(env = process.env) {
  return {
    primaryModel: env.AI_MODEL || DEFAULT_PRIMARY_MODEL,
    fallbackModel: env.AI_FALLBACK_MODEL || DEFAULT_FALLBACK_MODEL,
  };
}
