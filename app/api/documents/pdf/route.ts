import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createDocumentPdf } from '@/lib/documents/pdf';
import { prisma } from '@/lib/db/client';

const schema = z.object({ id: z.string().optional(), title: z.string().min(1).max(200), content: z.string().min(1).max(100000) });

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'A document title and content are required.', details: parsed.error.issues }, { status: 400 });
  if (parsed.data.id) {
    try {
      const updated = await prisma.generatedDocument.updateMany({ where: { id: parsed.data.id }, data: { content: parsed.data.content } });
      if (updated.count === 0) return NextResponse.json({ error: 'The saved document was not found.', code: 'DOCUMENT_NOT_FOUND' }, { status: 404 });
    } catch {
      return NextResponse.json({ error: 'The saved document could not be updated.' }, { status: 500 });
    }
  }
  const pdf = await createDocumentPdf(parsed.data.title, parsed.data.content);
  return new NextResponse(new Uint8Array(pdf), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="nyayaai-document.pdf"', 'Content-Length': String(pdf.length), 'Cache-Control': 'no-store' },
  });
}
