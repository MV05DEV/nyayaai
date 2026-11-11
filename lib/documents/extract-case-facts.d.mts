export type ExtractedCaseFacts = {
  facts: string[];
  orderedProduct: string | null;
  purchaseAmount: number | null;
  purchaseDate: string | null;
  deliveryDate: string | null;
  productReceived: string | null;
  sellerName: string | null;
  sellerAddress: string | null;
  platform: string | null;
  natureOfDispute: string | null;
  sellerResponse: string | null;
  evidence: string[];
  requestedRemedy: string | null;
  complainant: string | null;
};
export function extractCaseFacts(input: { description?: string; messages?: Array<{ role: string; content: string }>; supplied?: Record<string, any> }): ExtractedCaseFacts;
