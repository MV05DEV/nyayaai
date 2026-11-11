import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_RESPONSE_GUIDANCE, WARRANTY_GUIDANCE } from '../lib/ai/chat-guidance.mjs';
import { isTruncatedFinishReason } from '../lib/ai/completion-status.mjs';
import { formatLegalCitations } from '../lib/legal/format-citations.mjs';

const warrantySource = {
  id: 'ECOM2020-R6',
  sectionReference: 'Rule 6(3)',
  title: 'Marketplace seller duties for defective goods and refunds',
  content: 'Rule 6(3) seller duties apply to certain defective goods on marketplace platforms.',
  sourceTitle: 'Consumer Protection (E-Commerce) Rules, 2020',
  sourceUrl: 'https://example.gov.in/ecommerce-rules.pdf',
};

test('ordinary answers are bounded and follow-ups avoid repeated explanations', () => {
  assert.match(DEFAULT_RESPONSE_GUIDANCE, /150.{0,4}250 words/);
  assert.match(DEFAULT_RESPONSE_GUIDANCE, /one or two sentences/);
  assert.match(DEFAULT_RESPONSE_GUIDANCE, /at most five practical steps/);
  assert.match(DEFAULT_RESPONSE_GUIDANCE, /no more than three/);
  assert.match(DEFAULT_RESPONSE_GUIDANCE, /Do not repeat explanations already given/);
  assert.match(DEFAULT_RESPONSE_GUIDANCE, /answer only the new question or implication/);
});

test('warranty guidance avoids guaranteed free repair and distinguishes service actors', () => {
  assert.match(WARRANTY_GUIDANCE, /Never say.*automatically guarantees free repair/i);
  assert.match(WARRANTY_GUIDANCE, /warranty terms, exclusions, and inspection findings/);
  assert.match(WARRANTY_GUIDANCE, /manufacturer/i);
  assert.match(WARRANTY_GUIDANCE, /seller/i);
  assert.match(WARRANTY_GUIDANCE, /marketplace/i);
  assert.match(WARRANTY_GUIDANCE, /service centre/i);
  assert.match(WARRANTY_GUIDANCE, /why it was rejected/);
  assert.match(WARRANTY_GUIDANCE, /physical damage, liquid damage/);
});

test('citation formatting removes internal IDs and unsupported provisions, and links supported law', () => {
  const result = formatLegalCitations('The seller rule is ECOM2020-R6 (Rule 6(3)).\nRule 99 and [Section 999](https://fake.invalid) are unrelated unsupported claims.', [warrantySource]);
  assert.doesNotMatch(result.text, /ECOM2020-R6|Rule 99|Section 999|fake\.invalid|unrelated unsupported claims/);
  assert.match(result.text, /\[Consumer Protection \(E-Commerce\) Rules, 2020, Rule 6\(3\)\]\(https:\/\/example\.gov\.in\/ecommerce-rules\.pdf\)/);
  assert.doesNotMatch(result.text, /\]\([^\n]*\[Consumer Protection/);
  assert.equal(result.removed, true);
});

test('citation formatting suppresses sources explicitly marked unsupported', () => {
  const result = formatLegalCitations('Rule 6(3) applies.', [{ ...warrantySource, note: 'Source marked unsupported pending verification.' }]);
  assert.equal(result.text, '');
  assert.equal(result.removed, true);
});

test('truncation reasons are identified while normal completion reasons are accepted', () => {
  for (const reason of ['length', 'max_tokens', 'max output tokens', 'token_limit']) assert.equal(isTruncatedFinishReason(reason), true);
  for (const reason of ['stop', 'content_filter', null, undefined]) assert.equal(isTruncatedFinishReason(reason), false);
});
