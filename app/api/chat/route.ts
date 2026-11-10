import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAIProvider } from '@/lib/ai/provider';
import { isOutOfScope, LEGAL_DISCLAIMER } from '@/lib/ai/safety';
import { SYSTEM_PROMPT } from '@/lib/ai/prompts';
import { retrieveLegalChunks } from '@/lib/legal/retrieval';

const chatSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string().min(1).max(5000),
  })).min(1).max(50),
  language: z.enum(['en', 'hi']).default('en'),
  caseId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, language } = chatSchema.parse(body);

    const userMessage = messages[messages.length - 1];
    if (userMessage.role !== 'user') {
      return NextResponse.json({ error: 'Last message must be from user' }, { status: 400 });
    }

    // Safety check
    const scopeCheck = isOutOfScope(userMessage.content);
    if (scopeCheck.outOfScope) {
      return NextResponse.json({
        message: scopeCheck.message,
        isOutOfScope: true,
      });
    }

    // Retrieve relevant legal context
    const legalChunks = retrieveLegalChunks(userMessage.content, 4);
    const legalContext = legalChunks.length > 0
      ? `\n\nRELEVANT LEGAL INFORMATION (cite ONLY from these verified sources):\n${legalChunks.map(c => 
          `- ${c.sectionReference} (${c.sourceTitle}): ${c.content.substring(0, 300)}...`
        ).join('\n')}`
      : '';

    const languageInstruction = language === 'hi' 
      ? '\n\nIMPORTANT: The user prefers Hindi. Respond in Hindi (Devanagari script) but keep legal section references in English.'
      : '';

    const systemMessage = {
      role: 'system' as const,
      content: SYSTEM_PROMPT + legalContext + languageInstruction,
    };

    const provider = getAIProvider();
    const response = await provider.chat(
      [systemMessage, ...messages],
      { temperature: 0.4, maxTokens: 1500 }
    );

    return NextResponse.json({
      message: response.message || response.content,
      content: response.content,
      disclaimer: LEGAL_DISCLAIMER,
      legalSourcesUsed: legalChunks.map(c => ({
        id: c.id,
        title: c.title,
        sourceTitle: c.sourceTitle,
        sectionReference: c.sectionReference,
        sourceUrl: c.sourceUrl,
      })),
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request', details: error.errors }, { status: 400 });
    }
    
    const message = error instanceof Error ? error.message : 'Internal server error';
    
    if (message.includes('OPENROUTER_API_KEY')) {
      return NextResponse.json({ 
        error: 'AI service not configured. Please set OPENROUTER_API_KEY in .env file.',
        code: 'API_KEY_MISSING'
      }, { status: 503 });
    }

    console.error('Chat API error:', error);
    return NextResponse.json({ error: 'Failed to process request. Please try again.' }, { status: 500 });
  }
}
