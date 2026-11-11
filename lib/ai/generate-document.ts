import type { CaseData } from './extract-case';
import { extractCaseFacts } from '@/lib/documents/extract-case-facts.mjs';

export type DocumentType = 'COMPLAINT_LETTER' | 'LEGAL_NOTICE' | 'CONSUMER_FORUM_COMPLAINT' | 'REFUND_REQUEST' | 'NCH_GRIEVANCE';

export interface GeneratedDocument {
  type: DocumentType;
  title: string;
  content: string;
  disclaimer: string;
  generatedAt: string;
  legalSources: [];
}

export type DocumentCaseData = CaseData & {
  purchaseDate?: string | null;
  deliveryDate?: string | null;
  sellerAddress?: string | null;
  orderedProduct?: string | null;
  productReceived?: string | null;
  sellerResponse?: string | null;
};

const titles: Record<DocumentType, string> = {
  COMPLAINT_LETTER: 'Consumer Complaint Letter',
  LEGAL_NOTICE: 'Draft Legal Notice',
  CONSUMER_FORUM_COMPLAINT: 'Consumer Commission Complaint Draft',
  REFUND_REQUEST: 'Refund Request Letter',
  NCH_GRIEVANCE: 'National Consumer Helpline Grievance',
};

const valueOrPlaceholder = (value: string | null | undefined, label: string) => value?.trim() || `[Enter ${label}]`;
const money = (amount: number | null) => amount === null ? '[Enter purchase amount]' : `₹${amount.toLocaleString('en-IN')}`;

export async function generateDocument(
  documentType: DocumentType,
  caseData: DocumentCaseData,
  _additionalContext?: string,
): Promise<GeneratedDocument> {
  const extracted = extractCaseFacts({
    description: caseData.description,
    messages: caseData.facts.map(content => ({ role: 'user', content })),
    supplied: caseData,
  });
  if (!extracted.orderedProduct && extracted.facts.length === 0) {
    throw new Error('At least one relevant user-provided case fact is required.');
  }

  const product = valueOrPlaceholder(extracted.orderedProduct || caseData.title, 'product or service');
  const seller = valueOrPlaceholder(extracted.sellerName, 'seller name');
  const sellerAddress = valueOrPlaceholder(extracted.sellerAddress, 'seller address');
  const platform = valueOrPlaceholder(extracted.platform, 'platform, if applicable');
  const amount = money(extracted.purchaseAmount);
  const purchaseDate = valueOrPlaceholder(extracted.purchaseDate, 'purchase date');
  const deliveryDate = valueOrPlaceholder(extracted.deliveryDate, 'delivery date');
  const actualProduct = valueOrPlaceholder(extracted.productReceived, 'product actually received and known differences');
  const sellerResponse = valueOrPlaceholder(extracted.sellerResponse, 'seller response');
  const remedy = extracted.requestedRemedy || (extracted.natureOfDispute === 'Wrong product delivered' && extracted.purchaseAmount !== null
    ? `a refund of ${money(extracted.purchaseAmount)}`
    : '[State the remedy you are requesting]');

  const subject = extracted.natureOfDispute === 'Wrong product delivered' && extracted.purchaseAmount !== null
    ? `Request for refund of ${money(extracted.purchaseAmount)} – Wrong product delivered`
    : `Complaint regarding ${product}`;
  const invoiceSentence = extracted.evidence.some(item => /invoice/i.test(item))
    ? 'The original invoice is available to confirm the transaction and the item ordered.'
    : '';
  const firstParagraph = `On ${purchaseDate}, I placed an order through ${platform} for ${product}, at a purchase price of ${amount}. The order was delivered on ${deliveryDate}. ${invoiceSentence}`.trim();
  const evidence = extracted.evidence.length ? extracted.evidence : ['[List available evidence]'];
  const evidenceSentence = extracted.evidence.length
    ? ` I have the ${extracted.evidence.join(' and ')} as supporting evidence.`
    : '';
  const secondParagraph = `The product supplied was ${actualProduct}. I raised this issue with the seller, ${seller}, at ${sellerAddress}. The seller's response was: ${sellerResponse}. The matter remains unresolved.${evidenceSentence} Please compare the item supplied with the order record and invoice when reviewing this complaint.`;
  const thirdParagraph = `I request ${remedy}. Please confirm in writing how the item may be returned, arrange the return at no cost to me, and process the requested remedy after receiving it. I am willing to make the item available for inspection and return once clear instructions are provided. Please confirm any collection or return arrangements and the expected time for resolving my request. I look forward to your prompt written reply.`;
  const content = [
    'Date: [Enter date]',
    '',
    'To:',
    seller,
    sellerAddress,
    '',
    `Subject: ${subject}`,
    '',
    'Dear Sir/Madam,',
    '',
    firstParagraph,
    '',
    secondParagraph,
    '',
    thirdParagraph,
    '',
    'Yours faithfully,',
    valueOrPlaceholder(extracted.complainant, 'complainant name'),
    '[Enter address and contact details]',
    '[Signature]',
    '',
    'Enclosures:',
    ...evidence.map(item => `- ${item}`),
  ].join('\n');

  return {
    type: documentType,
    title: titles[documentType],
    content,
    disclaimer: 'Draft prepared from user-provided facts only. Complete the placeholders and review before sending.',
    generatedAt: new Date().toISOString(),
    legalSources: [],
  };
}
