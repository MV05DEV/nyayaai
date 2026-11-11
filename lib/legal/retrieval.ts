import { CONSUMER_PROTECTION_ACT_2019 } from '@/knowledge-base/sources/consumer-protection-act-2019';
import { ECOMMERCE_RULES_2020 } from '@/knowledge-base/sources/ecommerce-rules-2020';
import { CONSUMER_PROCEDURE_SOURCES } from '@/knowledge-base/sources/consumer-procedure';
import { getLegalQueryIntents } from './query-intents.mjs';

export interface LegalChunk {
  id: string;
  sectionReference: string;
  title: string;
  content: string;
  sourceTitle: string;
  sourceUrl: string;
  authority: string;
  publicationDate: string;
  verificationDate: string;
  keywords: string[];
  note?: string;
}

function buildChunks(): LegalChunk[] {
  const chunks: LegalChunk[] = [];

  for (const section of CONSUMER_PROTECTION_ACT_2019.sections) {
    chunks.push({
      id: section.id,
      sectionReference: section.sectionReference,
      title: section.title,
      content: section.content,
      sourceTitle: CONSUMER_PROTECTION_ACT_2019.title,
      sourceUrl: CONSUMER_PROTECTION_ACT_2019.sourceUrl,
      authority: CONSUMER_PROTECTION_ACT_2019.authority,
      publicationDate: CONSUMER_PROTECTION_ACT_2019.publicationDate,
      verificationDate: CONSUMER_PROTECTION_ACT_2019.verificationDate,
      keywords: section.keywords,
    });
  }

  for (const section of ECOMMERCE_RULES_2020.sections) {
    chunks.push({
      id: section.id,
      sectionReference: section.sectionReference,
      title: section.title,
      content: section.content,
      sourceTitle: ECOMMERCE_RULES_2020.title,
      sourceUrl: ECOMMERCE_RULES_2020.sourceUrl,
      authority: ECOMMERCE_RULES_2020.authority,
      publicationDate: ECOMMERCE_RULES_2020.publicationDate,
      verificationDate: ECOMMERCE_RULES_2020.verificationDate,
      keywords: section.keywords,
      note: ECOMMERCE_RULES_2020.note,
    });
  }

  for (const [id, source] of Object.entries(CONSUMER_PROCEDURE_SOURCES)) {
    chunks.push({ id: `PROCEDURE-${id.toUpperCase()}`, ...source, keywords: [...source.keywords] });
  }

  return chunks;
}

const ALL_CHUNKS = buildChunks();

export function retrieveLegalChunks(query: string, maxResults: number = 5): LegalChunk[] {
  const queryLower = query.toLowerCase();
  const intents = getLegalQueryIntents(query);
  const queryWords = queryLower.match(/[\p{L}\p{N}₹]+/gu)?.filter(w => w.length > 1) ?? [];

  const scored = ALL_CHUNKS.map(chunk => {
    let score = 0;
    const textToSearch = `${chunk.title} ${chunk.content} ${chunk.keywords.join(' ')}`.toLowerCase();

    for (const word of queryWords) {
      if (textToSearch.includes(word)) {
        score += chunk.keywords.some(k => k.toLowerCase().includes(word)) ? 3 : 1;
      }
    }

    if (intents.has('commission-filing') && chunk.id === 'PROCEDURE-EJAGRITI') score += 12;
    if (intents.has('nch-route') && chunk.id === 'PROCEDURE-NCH') score += 12;
    if (intents.has('filing-fee') && chunk.id === 'PROCEDURE-EJAGRITI') score += 8;

    return { chunk, score };
  });

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map(s => s.chunk);
}

export function getAllChunks(): LegalChunk[] {
  return ALL_CHUNKS;
}

export function removeUnretrievedCitations(text: string, chunks: LegalChunk[]): { text: string; removed: boolean } {
  const supportedReferences = new Set<string>();
  for (const chunk of chunks) {
    const sourceText = `${chunk.sectionReference} ${chunk.content}`;
    const referencePattern = /\b(?:Section|Rule)\s+\d+(?:\s*\(\s*\d+\s*\))*/gi;
    for (const match of sourceText.matchAll(referencePattern)) {
      supportedReferences.add(match[0].replace(/\s+/g, '').toLowerCase());
    }
  }

  let removed = false;
  const sanitized = text.replace(/\b(?:Section|Rule)\s+\d+(?:\s*\(\s*\d+\s*\))*/gi, citation => {
    if (supportedReferences.has(citation.replace(/\s+/g, '').toLowerCase())) return citation;
    removed = true;
    return '[legal citation omitted because no supporting source was retrieved]';
  });

  return { text: sanitized, removed };
}
