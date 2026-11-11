import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateLegalGuidance } from '@/lib/ai/legal-guidance';

const researchSchema = z.object({
  query: z.string().min(1).max(2000),
  category: z.string().default('GENERAL'),
  caseId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, category } = researchSchema.parse(body);

    const guidance = await generateLegalGuidance(query, category);

    return NextResponse.json(guidance);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request', details: error.issues }, { status: 400 });
    }
    
    const message = error instanceof Error ? error.message : 'Internal server error';
    if (message.includes('OPENROUTER_API_KEY')) {
      return NextResponse.json({ error: 'AI service not configured', code: 'API_KEY_MISSING' }, { status: 503 });
    }

    console.error('Legal research error:', error);
    return NextResponse.json({ error: 'Failed to retrieve legal information' }, { status: 500 });
  }
}

