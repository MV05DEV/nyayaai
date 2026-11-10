import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { extractCaseData } from '@/lib/ai/extract-case';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const case_ = await prisma.case.findUnique({
      where: { id: params.id },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });

    if (!case_) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    const conversationHistory = case_.messages.map(m => ({
      role: m.role,
      content: m.content,
    }));

    const caseData = await extractCaseData(conversationHistory);

    // Update the case with extracted data
    await prisma.case.update({
      where: { id: params.id },
      data: {
        title: caseData.title,
        category: caseData.category,
        amount: caseData.amount || undefined,
      },
    });

    return NextResponse.json(caseData);
  } catch (error) {
    console.error('Extract case error:', error);
    return NextResponse.json({ error: 'Failed to extract case data' }, { status: 500 });
  }
}
