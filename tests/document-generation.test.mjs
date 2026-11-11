import test from 'node:test';
import assert from 'node:assert/strict';

const baseUrl = process.env.NYAYAAI_TEST_URL || 'http://localhost:3000';
let completeCaseId;
let incompleteCaseId;
let generated;
const ssdFacts = [
  'Product ordered: Samsung 1TB external SSD. Purchase amount: ₹8,500. Purchase date: 21/10/2026.',
  'Seller name: Aman. Seller address: XYX Nagar, Bhadour. Actual product received: Different, lower-capacity product; exact capacity not provided.',
  'Seller refused to accept the return. Evidence: original invoice and unboxing video.',
  'How do I file a complaint?',
  'What filing fees are charged?',
];

async function createCase(description, amount) {
  const response = await fetch(`${baseUrl}/api/case`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'Wrong SSD delivered', category: 'WRONG_PRODUCT', description, amount }) });
  assert.equal(response.status, 201, await response.clone().text());
  return response.json();
}

async function saveMessage(caseId, content, role = 'user') {
  const response = await fetch(`${baseUrl}/api/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ caseId, role, content }) });
  assert.equal(response.status, 201, await response.clone().text());
}

test('SSD complaint uses only concise factual user details and requested letter structure', async () => {
  const complete = await createCase(ssdFacts.join(' '), 8500);
  completeCaseId = complete.id;
  for (const fact of ssdFacts) await saveMessage(completeCaseId, fact);
  await saveMessage(completeCaseId, 'This previous AI advice and explanation should never be copied into the letter.', 'assistant');
  const response = await fetch(`${baseUrl}/api/documents/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ caseId: completeCaseId, documentType: 'COMPLAINT_LETTER' }) });
  assert.equal(response.status, 200, `case ${completeCaseId}: ${await response.clone().text()}`);
  generated = await response.json();
  assert.equal(generated.type, 'COMPLAINT_LETTER');
  assert.match(generated.content, /Subject: Request for refund of ₹8,500 – Wrong product delivered/);
  assert.match(generated.content, /Samsung 1TB external SSD/);
  assert.match(generated.content, /21\/10\/2026/);
  assert.match(generated.content, /Aman/);
  assert.match(generated.content, /XYX Nagar, Bhadour/);
  assert.match(generated.content, /Different, lower-capacity product/);
  assert.match(generated.content, /exact capacity not provided/);
  assert.match(generated.content, /Seller refused to accept the return/);
  assert.match(generated.content, /Original invoice/);
  assert.match(generated.content, /Unboxing video/);
  assert.match(generated.content, /\[Enter delivery date\]/);
  assert.match(generated.content, /\[Enter platform, if applicable\]/);
  assert.doesNotMatch(generated.content, /filing fees|file a complaint|previous AI advice|exact capacity is (?:2|4|8)TB/i);
  assert.equal(generated.content.match(/Samsung 1TB external SSD/g)?.length, 1);
  assert.equal(generated.legalSources.length, 0);
  const letterBody = generated.content.split('Enclosures:')[0].replace(/\[Enter[^\]]*\]/g, '');
  const wordCount = letterBody.trim().split(/\s+/).length;
  assert.ok(wordCount >= 150 && wordCount <= 250, `letter word count was ${wordCount}`);
});

test('missing case details remain editable placeholders', async () => {
  const incomplete = await createCase('A laptop arrived with a defective display; the seller refused a refund.', 65000);
  incompleteCaseId = incomplete.id;
  await saveMessage(incompleteCaseId, 'The laptop display is defective. Seller refused refund.');
  const response = await fetch(`${baseUrl}/api/documents/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ caseId: incompleteCaseId, documentType: 'REFUND_REQUEST' }) });
  assert.equal(response.status, 200, await response.clone().text());
  const result = await response.json();
  assert.match(result.content, /\[Enter purchase date\]/);
  assert.match(result.content, /\[Enter delivery date\]/);
  assert.match(result.content, /\[Enter seller name\]/);
  assert.match(result.content, /\[Enter seller address\]/);
});

test('generated document contains no unsupported legal citations', () => {
  assert.deepEqual(generated.legalSources, []);
  assert.doesNotMatch(generated.content, /\b(?:Section|Rule)\s+\d+|\b(?:AIR|SCC|XYZ)\s*\d{4}/i);
});

test('invalid case IDs return a meaningful 404', async () => {
  const response = await fetch(`${baseUrl}/api/documents/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ caseId: 'invalid-case-id', documentType: 'REFUND_REQUEST' }) });
  assert.equal(response.status, 404);
  assert.equal((await response.json()).code, 'CASE_NOT_FOUND');
});

test('PDF endpoint accepts exactly the editable preview content and creates a PDF', async () => {
  assert.ok(generated.id, 'case-generated document should be persisted');
  const editedPreview = { id: generated.id, title: generated.title, content: generated.content.replace('[Enter date]', '11/11/2026') };
  const response = await fetch(`${baseUrl}/api/documents/pdf`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editedPreview) });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /application\/pdf/);
  assert.match(response.headers.get('content-disposition'), /attachment/);
  const bytes = new Uint8Array(await response.arrayBuffer());
  assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), '%PDF-');
  assert.ok(bytes.length > 500);
  const pdfSource = new TextDecoder('latin1').decode(bytes);
  assert.equal((pdfSource.match(/\/Type\s*\/Page\b/g) || []).length, 1, 'the complaint letter should fit on one page');
});

test('empty case facts are rejected with actionable validation', async () => {
  const response = await fetch(`${baseUrl}/api/documents/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ documentType: 'REFUND_REQUEST', caseData: {} }) });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, 'CASE_FACTS_REQUIRED');
});
