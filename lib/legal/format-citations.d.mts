export interface CitationSource {
  id: string;
  sectionReference: string;
  title: string;
  content: string;
  sourceTitle: string;
  sourceUrl: string;
  note?: string;
}
export function formatLegalCitations(text: string, retrievedChunks: CitationSource[]): { text: string; removed: boolean };
