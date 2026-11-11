import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { createDocumentPdf } from '@/lib/documents/pdf';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const saved = await prisma.generatedDocument.findUnique({ where: { id } });
  if (!saved) return NextResponse.json({ error: 'Generated document not found', code: 'DOCUMENT_NOT_FOUND' }, { status: 404 });

  const pdf = await createDocumentPdf(saved.documentType, saved.content);
  const filename = `${saved.documentType.toLowerCase().replace(/[^a-z0-9-]/g, '-')}.pdf`;
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(pdf.length),
      'Cache-Control': 'no-store',
    },
  });
}
