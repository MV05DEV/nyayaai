import test from 'node:test';
import assert from 'node:assert/strict';
import { extractCaseFacts } from '../lib/documents/extract-case-facts.mjs';

const userMessages = [
  'Product ordered: Samsung 1TB external SSD. Purchase amount: ₹8,500. Purchase date: 21/10/2026.',
  'Seller name: Aman. Seller address: XYX Nagar, Bhadour. Actual product received: Different, lower-capacity product; exact capacity not provided.',
  'Seller refused to accept the return. Evidence: original invoice and unboxing video.',
  'How do I file a complaint?',
  'What filing fees are charged?',
  'Product ordered: Samsung 1TB external SSD. Purchase amount: ₹8,500. Purchase date: 21/10/2026.',
];

test('extracts user case facts, excluding assistant content, procedure questions and repeats', () => {
  const result = extractCaseFacts({
    description: userMessages[0],
    messages: [
      ...userMessages.map(content => ({ role: 'user', content })),
      { role: 'assistant', content: 'This advice and generated legal explanation must not become case facts.' },
    ],
  });
  assert.equal(result.orderedProduct, 'Samsung 1TB external SSD');
  assert.equal(result.purchaseAmount, 8500);
  assert.equal(result.purchaseDate, '21/10/2026');
  assert.equal(result.deliveryDate, null);
  assert.match(result.productReceived, /Different, lower-capacity product; exact capacity not provided/);
  assert.doesNotMatch(result.productReceived, /2TB|4TB|capacity is/);
  assert.equal(result.sellerName, 'Aman');
  assert.equal(result.sellerAddress, 'XYX Nagar, Bhadour');
  assert.match(result.sellerResponse, /refused to accept the return/i);
  assert.deepEqual(result.evidence, ['Original invoice', 'Unboxing video']);
  assert.equal(result.facts.filter(fact => /Samsung 1TB external SSD/.test(fact)).length, 1);
  assert.ok(result.facts.every(fact => !/filing fees|file a complaint|generated legal explanation/i.test(fact)));
});

test('explicit purchase amount in the message takes precedence over a stale case summary amount', () => {
  const result = extractCaseFacts({ messages: [{ role: 'user', content: 'I paid ₹8,500 for the order.' }], supplied: { amount: 65000 } });
  assert.equal(result.purchaseAmount, 8500);
});
