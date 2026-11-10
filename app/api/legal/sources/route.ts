import { NextResponse } from 'next/server';
import { getAllChunks } from '@/lib/legal/retrieval';

export async function GET() {
  try {
    const chunks = getAllChunks();
    
    // Return unique sources
    const sources = new Map<string, object>();
    for (const chunk of chunks) {
      if (!sources.has(chunk.sourceTitle)) {
        sources.set(chunk.sourceTitle, {
          title: chunk.sourceTitle,
          authority: chunk.authority,
          sourceUrl: chunk.sourceUrl,
          publicationDate: chunk.publicationDate,
          verificationDate: chunk.verificationDate,
          sectionCount: 0,
        });
      }
      const src = sources.get(chunk.sourceTitle) as { sectionCount: number };
      src.sectionCount++;
    }

    return NextResponse.json({
      sources: Array.from(sources.values()),
      totalChunks: chunks.length,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Legal sources error:', error);
    return NextResponse.json({ error: 'Failed to fetch legal sources' }, { status: 500 });
  }
}
