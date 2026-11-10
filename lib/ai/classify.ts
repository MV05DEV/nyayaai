import { getAIProvider } from './provider';
import { CLASSIFY_PROMPT, SYSTEM_PROMPT } from './prompts';
import { isOutOfScope } from './safety';

export interface ClassificationResult {
  category: string;
  confidence: number;
  reasoning: string;
  isOutOfScope: boolean;
  outOfScopeMessage?: string;
}

export async function classifyIssue(userMessage: string): Promise<ClassificationResult> {
  // First do a quick safety check
  const scopeCheck = isOutOfScope(userMessage);
  if (scopeCheck.outOfScope) {
    return {
      category: 'OUT_OF_SCOPE',
      confidence: 0.95,
      reasoning: 'Topic outside consumer dispute scope',
      isOutOfScope: true,
      outOfScopeMessage: scopeCheck.message,
    };
  }

  const provider = getAIProvider();
  
  const response = await provider.chat([
    { role: 'system', content: CLASSIFY_PROMPT },
    { role: 'user', content: userMessage },
  ], { temperature: 0.1, maxTokens: 500 });

  try {
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');
    return JSON.parse(jsonMatch[0]);
  } catch {
    return {
      category: 'GENERAL',
      confidence: 0.5,
      reasoning: 'Could not classify',
      isOutOfScope: false,
    };
  }
}
