import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateDocument, type DocumentCaseData, type DocumentType } from '@/lib/ai/generate-document';
import { prisma } from '@/lib/db/client';

const caseDataSchema = z.object({
  title: z.string().default(''),
  category: z.string().default('GENERAL'),
  description: z.string().default(''),
  parties: z.object({
    complainant: z.string().nullable().default(null),
    respondent: z.string().nullable().default(null),
    platform: z.string().nullable().default(null),
  }).default({ complainant: null, respondent: null, platform: null }),
  facts: z.array(z.string()).default([]),
  timeline: z.array(z.object({ date: z.string().nullable(), event: z.string() })).default([]),
  amount: z.number().nullable().default(null),
  evidence: z.array(z.string()).default([]),
  missingInfo: z.array(z.string()).default([]),
  desiredOutcome: z.string().nullable().default(null),
  requiresLawyerConsultation: z.boolean().default(false),
  lawyerRecommendationReason: z.string().nullable().default(null),
  purchaseDate: z.string().nullable().optional(),
  deliveryDate: z.string().nullable().optional(),
  sellerAddress: z.string().nullable().optional(),
});

const requestSchema = z.object({
  documentType: z.enum(['COMPLAINT_LETTER', 'LEGAL_NOTICE', 'CONSUMER_FORUM_COMPLAINT', 'REFUND_REQUEST', 'NCH_GRIEVANCE']),
  caseId: z.string().optional(),
  caseData: caseDataSchema.optional(),
  additionalFacts: z.array(z.string()).optional(),
});

function mergeCaseData(saved: DocumentCaseData, supplied: DocumentCaseData, additionalFacts: string[]): DocumentCaseData {
  return {
    ...saved,
    ...supplied,
    title: supplied.title || saved.title,
    category: supplied.category || saved.category,
    description: [saved.description, supplied.description].filter(Boolean).join('\n\n'),
    parties: {
      complainant: supplied.parties.complainant || saved.parties.complainant,
      respondent: supplied.parties.respondent || saved.parties.respondent,
      platform: supplied.parties.platform || saved.parties.platform,
    },
    facts: [...new Set([...saved.facts, ...supplied.facts, ...additionalFacts])],
    timeline: [...saved.timeline, ...supplied.timeline],
    amount: supplied.amount ?? saved.amount,
    evidence: [...new Set([...saved.evidence, ...supplied.evidence])],
    missingInfo: [...new Set([...saved.missingInfo, ...supplied.missingInfo])],
    desiredOutcome: supplied.desiredOutcome || saved.desiredOutcome,
    purchaseDate: supplied.purchaseDate || saved.purchaseDate,
    deliveryDate: supplied.deliveryDate || saved.deliveryDate,
    sellerAddress: supplied.sellerAddress || saved.sellerAddress,
  };
}

function emptyCaseData(): DocumentCaseData {
  return {
    title: '', category: 'GENERAL', description: '',
    parties: { complainant: null, respondent: null, platform: null },
    facts: [], timeline: [], amount: null, evidence: [], missingInfo: [],
    desiredOutcome: null, requiresLawyerConsultation: false, lawyerRecommendationReason: null,
  };
}

export async function POST(request: NextRequest) {
  try {
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 });
    const { documentType, caseId, additionalFacts = [] } = parsed.data;
    const suppliedCaseData = parsed.data.caseData;
    let caseData = suppliedCaseData ?? emptyCaseData();

    if (caseId) {
      const savedCase = await prisma.case.findUnique({
        where: { id: caseId },
        include: {
          messages: { orderBy: { createdAt: 'asc' } },
          evidence: true,
        },
      });
      if (!savedCase) return NextResponse.json({ error: 'Case not found', code: 'CASE_NOT_FOUND' }, { status: 404 });

      const savedData: DocumentCaseData = {
        ...emptyCaseData(),
        title: savedCase.title,
        category: savedCase.category,
        description: savedCase.description,
        amount: savedCase.amount,
        facts: savedCase.messages.filter(message => message.role === 'user').map(message => message.content),
        timeline: savedCase.messages.filter(message => message.role === 'user').map(message => ({ date: message.createdAt.toISOString().slice(0, 10), event: message.content })),
        evidence: savedCase.evidence.map(item => item.description || item.fileName),
      };
      caseData = suppliedCaseData
        ? mergeCaseData(savedData, suppliedCaseData, additionalFacts)
        : { ...savedData, facts: [...new Set([...savedData.facts, ...additionalFacts])] };
    } else {
      caseData = mergeCaseData(emptyCaseData(), caseData, additionalFacts);
    }

    if (!caseData.description.trim() && caseData.facts.length === 0) {
      return NextResponse.json({ error: 'Add a case description or at least one case fact before generating a document.', code: 'CASE_FACTS_REQUIRED' }, { status: 400 });
    }

    const document = await generateDocument(documentType as DocumentType, caseData);
    let savedDocumentId: string | undefined;
    if (caseId) {
      try {
        const savedDocument = await prisma.generatedDocument.create({ data: { caseId, documentType, content: document.content } });
        savedDocumentId = savedDocument.id;
      } catch {
        console.warn('Generated document could not be saved to its case.');
      }
    }
    return NextResponse.json({ ...document, ...(savedDocumentId ? { id: savedDocumentId, downloadUrl: `/api/documents/${savedDocumentId}/pdf` } : {}) });
  } catch (error) {
    console.error('Document generation failed:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Unable to prepare the document. Check the supplied case facts and try again.' }, { status: 500 });
  }
}
