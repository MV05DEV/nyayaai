import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateDocument } from '@/lib/ai/generate-document';
import { prisma } from '@/lib/db/client';

const generateDocSchema = z.object({
  documentType: z.enum(['COMPLAINT_LETTER', 'LEGAL_NOTICE', 'CONSUMER_FORUM_COMPLAINT', 'REFUND_REQUEST', 'NCH_GRIEVANCE']),
  caseId: z.string().optional(),
  caseData: z.object({
    title: z.string(),
    category: z.string(),
    description: z.string(),
    parties: z.object({
      complainant: z.string().nullable(),
      respondent: z.string().nullable(),
      platform: z.string().nullable(),
    }),
    facts: z.array(z.string()),
    timeline: z.array(z.object({ date: z.string().nullable(), event: z.string() })),
    amount: z.number().nullable(),
    evidence: z.array(z.string()),
    missingInfo: z.array(z.string()),
    desiredOutcome: z.string().nullable(),
    requiresLawyerConsultation: z.boolean(),
    lawyerRecommendationReason: z.string().nullable(),
  }),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { documentType, caseId, caseData } = generateDocSchema.parse(body);

    const doc = await generateDocument(documentType, caseData);

    // Save to database if caseId provided
    if (caseId) {
      try {
        await prisma.generatedDocument.create({
          data: {
            caseId,
            documentType,
            content: doc.content,
          },
        });
      } catch (dbError) {
        console.warn('Could not save document to database:', dbError);
      }
    }

    return NextResponse.json(doc);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request', details: error.errors }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : 'Internal server error';
    if (message.includes('OPENROUTER_API_KEY')) {
      return NextResponse.json({ error: 'AI service not configured', code: 'API_KEY_MISSING' }, { status: 503 });
    }

    console.error('Document generation error:', error);
    return NextResponse.json({ error: 'Failed to generate document' }, { status: 500 });
  }
}
