import { getAllChunks } from '@/lib/legal/retrieval';

export type { LegalChunk } from '@/lib/legal/retrieval';

// All legal chunks as a flat array for retrieval
export const ALL_LEGAL_CHUNKS = getAllChunks();
