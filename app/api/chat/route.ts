import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAIProvider } from '@/lib/ai/provider';
import { isOutOfScope, LEGAL_DISCLAIMER } from '@/lib/ai/safety';
import { CONSUMER_LEGAL_ACCURACY_RULES, SYSTEM_PROMPT } from '@/lib/ai/prompts';
import { formatLegalCitations } from '@/lib/legal/format-citations.mjs';
import { retrieveLegalChunks } from '@/lib/legal/retrieval';
import { DEFAULT_RESPONSE_GUIDANCE, WARRANTY_GUIDANCE } from '@/lib/ai/chat-guidance.mjs';

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
      ? `\n\nRETRIEVED LEGAL SOURCES (use only these; cite a relevant provision with a Markdown link to the listed official/source URL):\n${legalChunks.map(c => 
          `- Provision: ${c.sectionReference}; provision title: ${c.title}; source: ${c.sourceTitle}; URL: ${c.sourceUrl}; verification date: ${c.verificationDate}${c.note ? `; Source note: ${c.note}` : ''}\n  ${c.content}`
        ).join('\n')}`
      : '\n\nNO MATCHING LEGAL SOURCES WERE RETRIEVED. State that the knowledge base cannot verify legal provisions for this question. Do not cite provisions, give fee estimates, or assert procedural details as verified.';

    const languageInstruction = language === 'hi' 
      ? '\n\nIMPORTANT: The user prefers Hindi. Respond in Hindi (Devanagari script) but keep legal section references in English.'
      : '';

    const systemMessage = {
      role: 'system' as const,
      content: SYSTEM_PROMPT + '\n\n' + DEFAULT_RESPONSE_GUIDANCE + '\n\n' + WARRANTY_GUIDANCE + '\n\n' + CONSUMER_LEGAL_ACCURACY_RULES + legalContext + languageInstruction,
    };

    const provider = getAIProvider();
    const response = await provider.chat(
      [systemMessage, ...messages],
      { temperature: 0.4, maxTokens: 2000 }
    );

    const groundedContent = formatLegalCitations(response.content, legalChunks).text;
    if (!groundedContent.trim()) {
      return NextResponse.json({ error: 'Something went wrong. Please try again.', code: 'CHAT_FAILED' }, { status: 502 });
    }

    return NextResponse.json({
      message: groundedContent,
      content: groundedContent,
      disclaimer: LEGAL_DISCLAIMER,
      legalSourcesUsed: legalChunks.filter(c => !/unsupported|unverified|not verified|source uncertain/i.test(c.note || '')).map(c => ({
        title: c.title,
        sourceTitle: c.sourceTitle,
        sectionReference: c.sectionReference,
        sourceUrl: c.sourceUrl,
      })),
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request', details: error.issues }, { status: 400 });
    }

    const failure = error && typeof error === 'object' ? error as { code?: unknown; status?: unknown; retryable?: unknown; retryAfterSeconds?: unknown } : {};
    const code = typeof failure.code === 'string' ? failure.code : 'CHAT_FAILED';
    if (process.env.NODE_ENV !== 'production') {
      console.error('Chat request failed', {
        code,
        httpStatus: typeof failure.status === 'number' ? failure.status : null,
        retryable: typeof failure.retryable === 'boolean' ? failure.retryable : null,
      });
    }

    if (code === 'RATE_LIMITED') {
      const retryAfterSeconds = typeof failure.retryAfterSeconds === 'number' && Number.isFinite(failure.retryAfterSeconds)
        ? Math.min(Math.max(0, Math.ceil(failure.retryAfterSeconds)), 86400)
        : null;
      return NextResponse.json(
        { error: 'The AI service is currently busy. Please wait a little and try again.', code, ...(retryAfterSeconds === null ? {} : { retryAfterSeconds }) },
        { status: 429, ...(retryAfterSeconds === null ? {} : { headers: { 'Retry-After': String(retryAfterSeconds) } }) },
      );
    }
    if (code === 'API_KEY_MISSING') {
      return NextResponse.json({ error: 'Something went wrong. Please try again.', code: 'CHAT_FAILED' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Something went wrong. Please try again.', code: 'CHAT_FAILED' }, { status: 500 });
  }
}
