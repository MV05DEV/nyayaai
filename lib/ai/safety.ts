const OUT_OF_SCOPE_TOPICS = [
  'murder', 'theft', 'robbery', 'assault', 'rape', 'criminal', 'fir', 'police complaint',
  'divorce', 'marriage', 'custody', 'alimony', 'property dispute', 'land', 'inheritance',
  'will', 'testament', 'visa', 'passport', 'immigration', 'citizenship',
  'income tax', 'gst evasion', 'customs duty', 'stock market', 'securities fraud',
  'employment', 'workplace harassment', 'labour court', 'accident', 'insurance claim'
];

export function isOutOfScope(message: string): { outOfScope: boolean; message?: string } {
  const messageLower = message.toLowerCase();
  
  for (const topic of OUT_OF_SCOPE_TOPICS) {
    if (messageLower.includes(topic)) {
      return {
        outOfScope: true,
        message: `I'm sorry, but NyayaAI specializes only in consumer disputes (defective products, refunds, e-commerce issues, etc.). The topic you mentioned (${topic}) falls outside my scope. For this type of matter, I recommend consulting a qualified lawyer or visiting your nearest legal aid center. You can also contact the National Legal Services Authority (NALSA) at nalsa.gov.in for free legal aid.`
      };
    }
  }
  
  return { outOfScope: false };
}

export function sanitizeForDocument(text: string): string {
  // Remove any attempts to inject system instructions
  return text.replace(/\[SYSTEM\]/gi, '').replace(/\[INST\]/gi, '').trim();
}

export const LEGAL_DISCLAIMER = `⚠️ DISCLAIMER: NyayaAI provides general legal information for educational purposes only. This is NOT legal advice and does NOT create a lawyer-client relationship. Laws and regulations change; always verify current provisions. For important legal matters, please consult a qualified advocate registered with the Bar Council of India.`;
