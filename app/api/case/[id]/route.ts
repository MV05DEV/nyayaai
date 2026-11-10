import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const case_ = await prisma.case.findUnique({
      where: { id: params.id },
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

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const data = updateCaseSchema.parse(body);

    const case_ = await prisma.case.update({
      where: { id: params.id },
      data,
    });

    return NextResponse.json(case_);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.errors }, { status: 400 });
    }
    console.error('Update case error:', error);
    return NextResponse.json({ error: 'Failed to update case' }, { status: 500 });
  }
}
