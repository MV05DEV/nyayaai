import PDFDocument from 'pdfkit';

export async function createDocumentPdf(title: string, content: string): Promise<Buffer> {
  const pdf = new PDFDocument({
    size: 'A4',
    margins: { top: 48, bottom: 48, left: 58, right: 58 },
    info: { Title: title },
  });
  const chunks: Buffer[] = [];
  pdf.on('data', chunk => chunks.push(Buffer.from(chunk)));
  const complete = new Promise<Buffer>((resolve, reject) => {
    pdf.on('end', () => resolve(Buffer.concat(chunks)));
    pdf.on('error', reject);
  });
  const lines = content.split('\n');
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      pdf.moveDown(0.4);
      continue;
    }
    if (/^Subject:/i.test(line)) {
      pdf.moveDown(0.2).font('Helvetica-Bold').fontSize(11).fillColor('#000000').text(line, { lineGap: 2 });
    } else if (/^(Date:|To:|Dear Sir\/Madam,|Yours faithfully,|Enclosures:)/i.test(line)) {
      pdf.font('Helvetica-Bold').fontSize(10.5).fillColor('#000000').text(line, { lineGap: 2 });
    } else if (/^- /.test(line)) {
      pdf.font('Helvetica').fontSize(10.5).fillColor('#000000').text(line, { indent: 12, lineGap: 2 });
    } else {
      pdf.font('Helvetica').fontSize(10.5).fillColor('#000000').text(line, { lineGap: 3 });
    }
  }
  pdf.end();
  return complete;
}
