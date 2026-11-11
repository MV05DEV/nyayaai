export const GENERIC_CHAT_ERROR: string;
export const RATE_LIMIT_CHAT_ERROR: string;
export function acquireChatRequest(gate: { inFlight: boolean; nextAllowedAt: number }, now?: number, minimumIntervalMs?: number): boolean;
export function deferChatRequest(gate: { inFlight: boolean; nextAllowedAt: number }, seconds: number | null | undefined, now?: number): void;
export function releaseChatRequest(gate: { inFlight: boolean; nextAllowedAt: number }): void;
export function prepareChatSubmission(turns: Array<{ role: 'user' | 'assistant'; content: string }>, text: string, retry?: boolean): {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  shouldAppendUserTurn: boolean;
};
export function chatErrorMessage(code?: string | null): string;
