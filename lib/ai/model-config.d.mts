export const DEFAULT_PRIMARY_MODEL: string;
export const DEFAULT_FALLBACK_MODEL: string;
export function resolveAIModelConfig(env?: Record<string, string | undefined>): {
  primaryModel: string;
  fallbackModel: string;
};
