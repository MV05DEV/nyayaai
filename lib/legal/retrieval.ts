import { CONSUMER_PROTECTION_ACT_2019 } from '@/knowledge-base/sources/consumer-protection-act-2019';
import { ECOMMERCE_RULES_2020 } from '@/knowledge-base/sources/ecommerce-rules-2020';

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

  return chunks;
}

const ALL_CHUNKS = buildChunks();

export function retrieveLegalChunks(query: string, maxResults: number = 5): LegalChunk[] {
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);

  const scored = ALL_CHUNKS.map(chunk => {
    let score = 0;
    const textToSearch = `${chunk.title} ${chunk.content} ${chunk.keywords.join(' ')}`.toLowerCase();

    for (const word of queryWords) {
      if (textToSearch.includes(word)) {
        score += chunk.keywords.some(k => k.toLowerCase().includes(word)) ? 3 : 1;
      }
    }

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
