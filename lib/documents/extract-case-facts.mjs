const excludedQuestion = /\?|\bhow (?:do|can|to) (?:i )?(?:file|lodge|submit)|\bwhat (?:is|are) (?:the )?(?:filing|court|case)?\s*fees?|\bwhat can i do legally|\blegal advice\b|\bwhat are my rights\b|\b(?:legal procedure|filing procedure|court fee|filing fee)\b/i;

function normalize(value) {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

export function extractCaseFacts({ description = '', messages = [], supplied = {} }) {
  const userContent = [description, ...messages.filter(message => message.role === 'user').map(message => message.content)]
    .filter(Boolean)
    .flatMap(value => value.split(/(?<=[.!?])\s+|\n+/))
    .map(value => value.trim())
    .filter(value => value && !excludedQuestion.test(value));
  const unique = [];
  const seen = new Set();
  for (const fact of userContent) {
    const key = normalize(fact);
    if (key && !seen.has(key)) { seen.add(key); unique.push(fact); }
  }

  const combined = unique.join(' ');
  const explicit = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;
  const amountMatch = combined.match(/(?:₹|INR\s*|Rs\.?\s*)([\d,]+(?:\.\d+)?)/i);
  const dateMatch = combined.match(/\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b/);
  const productMatch = combined.match(/(?:product ordered\s*:\s*|(?:ordered|purchased|bought)\s+(?:a\s+|an\s+)?)(.+?)(?=\s+(?:for|on|from|through|via)\b|[,.]|$)/i);
  const sellerMatch = combined.match(/seller(?: name)?\s*(?:is|:|named)\s*([^,.;\n]+)/i);
  const sellerAddressMatch = combined.match(/seller address\s*:\s*([^.;\n]+)/i);
  const platformMatch = combined.match(/(?:on|through|via)\s+(?:the\s+)?platform\s+([\p{L}\d .'-]+)/iu);
  const receivedMatch = combined.match(/(?:actual product received\s*:\s*|(?:received|delivered)\s+(?:a\s+)?)(.+?)(?=\s+(?:seller|but|and the seller)\b|[.]|$)/i);
  const evidence = [];
  if (/invoice/i.test(combined)) evidence.push('Original invoice');
  if (/unboxing video/i.test(combined)) evidence.push('Unboxing video');
  if (/photographs?|photos?/i.test(combined)) evidence.push('Photographs');
  const sellerResponse = /seller (?:refused|declined) to accept (?:the )?return/i.test(combined)
    ? 'Seller refused to accept the return'
    : /seller (?:refused|rejected) (?:the )?refund/i.test(combined) ? 'Seller refused the refund' : null;
  const nature = /different|wrong product|lower.capacity/i.test(combined) ? 'Wrong product delivered' : /defect|damaged/i.test(combined) ? 'Defective product' : null;

  return {
    facts: unique,
    orderedProduct: explicit(supplied.orderedProduct) || productMatch?.[1]?.trim() || null,
    purchaseAmount: amountMatch ? Number(amountMatch[1].replaceAll(',', '')) : (supplied.amount ?? null),
    purchaseDate: explicit(supplied.purchaseDate) || dateMatch?.[1] || null,
    deliveryDate: explicit(supplied.deliveryDate),
    productReceived: explicit(supplied.productReceived) || receivedMatch?.[1]?.trim() || (nature === 'Wrong product delivered' ? 'A different product; exact product and capacity not provided' : null),
    sellerName: explicit(supplied.parties?.respondent) || sellerMatch?.[1]?.trim() || null,
    sellerAddress: explicit(supplied.sellerAddress) || sellerAddressMatch?.[1]?.trim() || null,
    platform: explicit(supplied.parties?.platform) || platformMatch?.[1]?.trim() || null,
    natureOfDispute: nature,
    sellerResponse: explicit(supplied.sellerResponse) || sellerResponse,
    evidence: [...new Set([...(supplied.evidence || []), ...evidence])],
    requestedRemedy: explicit(supplied.desiredOutcome),
    complainant: explicit(supplied.parties?.complainant),
    facts: unique,
  };
}
