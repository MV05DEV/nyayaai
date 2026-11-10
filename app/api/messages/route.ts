import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';

const messageSchema = z.object({
  caseId: z.string().optional(),
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(10000),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = messageSchema.parse(body);

    const message = await prisma.message.create({ data });
    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.errors }, { status: 400 });
    }
    console.error('Create message error:', error);
    return NextResponse.json({ error: 'Failed to save message' }, { status: 500 });
  }
}
