import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import { isLocalDevelopmentRequest } from '@/lib/db/destructive-requests';
import { deleteCaseRecord } from '@/lib/db/case-cleanup.mjs';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const case_ = await prisma.case.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: 'asc' } }, documents: true },
    });

    if (!case_) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    return NextResponse.json(case_);
  } catch (error) {
    console.error('Get case error:', error);
    return NextResponse.json({ error: 'Failed to fetch case' }, { status: 500 });
  }
}

const updateCaseSchema = z.object({
  title: z.string().optional(),
  status: z.string().optional(),
  amount: z.number().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const data = updateCaseSchema.parse(body);

    const case_ = await prisma.case.update({
      where: { id },
      data,
    });

    return NextResponse.json(case_);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.issues }, { status: 400 });
    }
    console.error('Update case error:', error);
    return NextResponse.json({ error: 'Failed to update case' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isLocalDevelopmentRequest(request)) {
    return NextResponse.json({ error: 'Conversation deletion is available only from the local development app.' }, { status: 403 });
  }
  if (request.headers.get('x-nyayaai-cleanup-confirm') !== 'delete-conversation') {
    return NextResponse.json({ error: 'Explicit confirmation is required to delete this conversation.' }, { status: 400 });
  }
  const { id } = await params;
  if (!/^[a-z0-9]{20,32}$/i.test(id)) {
    return NextResponse.json({ error: 'Invalid conversation ID.' }, { status: 400 });
  }

  try {
    const result = await deleteCaseRecord(prisma, id);
    if (!result) return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });
    return NextResponse.json({ success: true, id });
  } catch {
    return NextResponse.json({ error: 'Could not delete the conversation. No changes were committed.' }, { status: 500 });
  }
}
