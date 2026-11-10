import { getAIProvider } from './provider';
import { EXTRACT_CASE_PROMPT } from './prompts';

export interface CaseData {
  title: string;
  category: string;
  description: string;
  parties: {
    complainant: string | null;
    respondent: string | null;
    platform: string | null;
  };
  facts: string[];
  timeline: Array<{ date: string | null; event: string }>;
  amount: number | null;
  evidence: string[];
  missingInfo: string[];
  desiredOutcome: string | null;
  requiresLawyerConsultation: boolean;
  lawyerRecommendationReason: string | null;
}

export async function extractCaseData(conversationHistory: Array<{ role: string; content: string }>): Promise<CaseData> {
  const provider = getAIProvider();
  
  const conversationText = conversationHistory
    .map(m => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n');

  const response = await provider.chat([
    { role: 'system', content: EXTRACT_CASE_PROMPT },
    { role: 'user', content: `Extract case data from this conversation:\n\n${conversationText}` },
  ], { temperature: 0.1, maxTokens: 1500 });

  try {
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');
    return JSON.parse(jsonMatch[0]);
  } catch {
    return {
      title: 'Consumer Dispute',
      category: 'GENERAL',
      description: conversationHistory.find(m => m.role === 'user')?.content || '',
      parties: { complainant: null, respondent: null, platform: null },
      facts: [],
      timeline: [],
      amount: null,
      evidence: [],
      missingInfo: ['Complete case details needed'],
      desiredOutcome: null,
      requiresLawyerConsultation: false,
      lawyerRecommendationReason: null,
    };
  }
}
