import { getAIProvider } from './provider';
import { DOCUMENT_GENERATION_PROMPT } from './prompts';
import type { CaseData } from './extract-case';

export type DocumentType = 
  | 'COMPLAINT_LETTER' 
  | 'LEGAL_NOTICE' 
  | 'CONSUMER_FORUM_COMPLAINT' 
  | 'REFUND_REQUEST' 
  | 'NCH_GRIEVANCE';

export interface GeneratedDocument {
  type: DocumentType;
  title: string;
  content: string;
  disclaimer: string;
  generatedAt: string;
}

export async function generateDocument(
  documentType: DocumentType,
  caseData: CaseData,
  additionalContext?: string
): Promise<GeneratedDocument> {
  const provider = getAIProvider();

  const caseContext = `
Case Information (provided by user - use ONLY this information):
- Category: ${caseData.category}
- Description: ${caseData.description}
- Complainant: ${caseData.parties.complainant || '[PLACEHOLDER: Your Full Name]'}
- Respondent/Company: ${caseData.parties.respondent || '[PLACEHOLDER: Company Name]'}
- Platform: ${caseData.parties.platform || 'N/A'}
- Amount Involved: ${caseData.amount ? `₹${caseData.amount}` : '[PLACEHOLDER: Amount]'}
- Evidence Available: ${caseData.evidence.join(', ') || 'Not specified'}
- Desired Outcome: ${caseData.desiredOutcome || 'Resolution of complaint'}
- Key Facts: ${caseData.facts.join('; ')}
- Timeline: ${caseData.timeline.map(t => `${t.date || 'Unknown date'}: ${t.event}`).join('; ')}
${additionalContext ? `Additional Context: ${additionalContext}` : ''}`;

  const response = await provider.chat([
    { role: 'system', content: DOCUMENT_GENERATION_PROMPT },
    { role: 'user', content: `Generate a ${documentType} document.\n\n${caseContext}` },
  ], { temperature: 0.3, maxTokens: 2000 });

  const titles: Record<DocumentType, string> = {
    COMPLAINT_LETTER: 'Formal Complaint Letter',
    LEGAL_NOTICE: 'Draft Legal Notice',
    CONSUMER_FORUM_COMPLAINT: 'Consumer Forum Complaint',
    REFUND_REQUEST: 'Refund Request Email',
    NCH_GRIEVANCE: 'National Consumer Helpline Grievance',
  };

  return {
    type: documentType,
    title: titles[documentType],
    content: response.content,
    disclaimer: '⚠️ DRAFT DOCUMENT - This is an AI-generated draft for reference only. It MUST be reviewed by a qualified advocate before filing or sending. Names, dates, and details marked as [PLACEHOLDER] must be filled in. The law firm or advocate may need to modify this document based on specific facts and applicable law.',
    generatedAt: new Date().toISOString(),
  };
}
