import { getAIProvider } from './provider';
import { LEGAL_GUIDANCE_PROMPT } from './prompts';
import { retrieveLegalChunks, type LegalChunk } from '@/lib/legal/retrieval';

export interface LegalGuidance {
  summary: string;
  relevantProvisions: Array<{
    sectionReference: string;
    sourceTitle: string;
    explanation: string;
    sourceUrl: string;
    verificationDate: string;
  }>;
  possibleRemedies: string[];
  documentsRequired: string[];
  recommendedActions: Array<{
    step: number;
    action: string;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
  }>;
  uncertainties: string[];
  requiresLawyerConsultation: boolean;
  lawyerRecommendationReason: string | null;
  disclaimer: string;
  retrievedSources: LegalChunk[];
}

export async function generateLegalGuidance(caseDescription: string, category: string): Promise<LegalGuidance> {
  const provider = getAIProvider();
  
  // Retrieve relevant legal chunks
  const query = `${category} ${caseDescription}`;
  const legalChunks = retrieveLegalChunks(query, 6);
  
  const legalContext = legalChunks.length > 0
    ? `LEGAL SOURCES (use ONLY these for citations):\n\n${legalChunks.map(c => 
        `[${c.id}] ${c.sectionReference} - ${c.title}\nSource: ${c.sourceTitle}\nURL: ${c.sourceUrl}\nVerified: ${c.verificationDate}\n${c.content}${c.note ? `\nNote: ${c.note}` : ''}`
      ).join('\n\n')}`
    : 'NO VERIFIED LEGAL SOURCES FOUND for this query. Do not cite any legal provisions.';

  const userMessage = `Case Category: ${category}\n\nCase Description: ${caseDescription}\n\n${legalContext}`;

  const response = await provider.chat([
    { role: 'system', content: LEGAL_GUIDANCE_PROMPT },
    { role: 'user', content: userMessage },
  ], { temperature: 0.2, maxTokens: 2000 });

  try {
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');
    const guidance = JSON.parse(jsonMatch[0]);
    return { ...guidance, retrievedSources: legalChunks };
  } catch {
    return {
      summary: 'Unable to generate legal guidance at this time. Please try again.',
      relevantProvisions: [],
      possibleRemedies: ['Contact the company directly with a formal complaint'],
      documentsRequired: ['Purchase invoice/receipt', 'Communication records'],
      recommendedActions: [
        { step: 1, action: 'File a formal complaint with the company', priority: 'HIGH' as const },
        { step: 2, action: 'Contact National Consumer Helpline at 1800-11-4000', priority: 'HIGH' as const },
      ],
      uncertainties: ['Unable to verify legal provisions'],
      requiresLawyerConsultation: true,
      lawyerRecommendationReason: 'Could not retrieve legal guidance; please consult a lawyer',
      disclaimer: 'This information is for educational purposes only.',
      retrievedSources: legalChunks,
    };
  }
}
