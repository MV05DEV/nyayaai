import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import { isLocalDevelopmentRequest } from '@/lib/db/destructive-requests';
import { clearCaseRecords } from '@/lib/db/case-cleanup.mjs';

const createCaseSchema = z.object({
  title: z.string().min(1).max(200),
  category: z.string().default('GENERAL'),
  description: z.string().min(1).max(5000),
  amount: z.number().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = createCaseSchema.parse(body);

    const case_ = await prisma.case.create({
      data: {
        title: data.title,
        category: data.category,
        description: data.description,
        amount: data.amount,
        status: 'OPEN',
      },
    });

    return NextResponse.json(case_, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.issues }, { status: 400 });
    }
    console.error('Create case error:', error);
    return NextResponse.json({ error: 'Failed to create case' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const cases = await prisma.case.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return NextResponse.json(cases);
  } catch (error) {
    console.error('Get cases error:', error);
    return NextResponse.json({ error: 'Failed to fetch cases' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!isLocalDevelopmentRequest(request)) {
    return NextResponse.json({ error: 'Conversation cleanup is available only from the local development app.' }, { status: 403 });
  }
  if (request.headers.get('x-nyayaai-cleanup-confirm') !== 'clear-all-conversations') {
    return NextResponse.json({ error: 'Explicit confirmation is required to clear all conversations.' }, { status: 400 });
  }

  try {
    const deletedCases = await clearCaseRecords(prisma);
    return NextResponse.json({ success: true, deletedCases });
  } catch {
    return NextResponse.json({ error: 'Could not clear conversations. No changes were committed.' }, { status: 500 });
  }
}

