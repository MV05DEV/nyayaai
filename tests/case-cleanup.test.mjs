import test from "node:test";
import assert from "node:assert/strict";
import { clearCaseRecords } from "../lib/db/case-cleanup.mjs";

const baseUrl = process.env.NYAYAAI_TEST_URL || "http://localhost:3000";
const localHeaders = { Origin: baseUrl, "x-nyayaai-cleanup-confirm": "delete-conversation" };
async function createCase() {
  const response = await fetch(`${baseUrl}/api/case`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "Cleanup test conversation", description: "Test record for deletion checks." }) });
  assert.equal(response.status, 201);
  return response.json();
}

async function createCaseWithMessagesAndDocument() {
  const saved = await createCase();
  for (const role of ["user", "assistant"]) {
    const message = await fetch(`${baseUrl}/api/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ caseId: saved.id, role, content: `Test ${role} message` }) });
    assert.equal(message.status, 201);
  }
  const generated = await fetch(`${baseUrl}/api/documents/generate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ caseId: saved.id, documentType: "REFUND_REQUEST" }) });
  assert.equal(generated.status, 200);
  return saved.id;
}

test("missing explicit confirmation is rejected without deleting the case", async () => {
  const caseId = await createCaseWithMessagesAndDocument();
  const response = await fetch(`${baseUrl}/api/case/${caseId}`, { method: "DELETE", headers: { Origin: baseUrl } });
  assert.equal(response.status, 400);
  assert.equal((await fetch(`${baseUrl}/api/case/${caseId}`)).status, 200);
});

test("individual delete removes case, multiple messages, and generated documents", async () => {
  const caseId = await createCaseWithMessagesAndDocument();
  const legalSourceCount = (await fetch(`${baseUrl}/api/legal/sources`).then(response => response.json())).totalChunks;
  const response = await fetch(`${baseUrl}/api/case/${caseId}`, { method: "DELETE", headers: localHeaders });
  assert.equal(response.status, 200);
  assert.equal((await fetch(`${baseUrl}/api/case/${caseId}`)).status, 404);
  const sources = await fetch(`${baseUrl}/api/legal/sources`).then(result => result.json());
  assert.equal(sources.totalChunks, legalSourceCount);
});

test("nonexistent and malformed case IDs return meaningful errors", async () => {
  const missing = await fetch(`${baseUrl}/api/case/cmmissing1234567890123456`, { method: "DELETE", headers: localHeaders });
  assert.equal(missing.status, 404);
  const malformed = await fetch(`${baseUrl}/api/case/not-valid`, { method: "DELETE", headers: localHeaders });
  assert.equal(malformed.status, 400);
});

test("clear-all cleanup is transactional and leaves legal sources untouched", async () => {
  const state = {
    cases: [{ id: "case-a" }, { id: "case-b" }],
    messages: [{ caseId: "case-a" }, { caseId: "case-b" }, { caseId: null }],
    evidence: [{ caseId: "case-a" }],
    documents: [{ caseId: "case-b" }],
    legalSources: [{ id: "law-1" }],
  };
  const client = {
    async $transaction(work) {
      const pending = structuredClone(state);
      const tx = fakeTransaction(pending);
      const count = await work(tx);
      Object.assign(state, pending);
      return count;
    },
  };
  const deleted = await clearCaseRecords(client);
  assert.equal(deleted, 2);
  assert.deepEqual(state.cases, []);
  assert.deepEqual(state.messages, [{ caseId: null }]);
  assert.deepEqual(state.evidence, []);
  assert.deepEqual(state.documents, []);
  assert.deepEqual(state.legalSources, [{ id: "law-1" }]);
});

test("transaction failure rolls back all pending cleanup operations", async () => {
  const state = { cases: [{ id: "case-a" }], messages: [{ caseId: "case-a" }], evidence: [], documents: [], legalSources: [{ id: "law-1" }] };
  const original = structuredClone(state);
  const client = {
    async $transaction(work) {
      const pending = structuredClone(state);
      await work(fakeTransaction(pending, true));
      Object.assign(state, pending);
    },
  };
  await assert.rejects(clearCaseRecords(client));
  assert.deepEqual(state, original);
});

function fakeTransaction(state, failOnDocumentDelete = false) {
  const filter = (rows, where) => rows.filter(row => !where.caseId.in.includes(row.caseId));
  return {
    case: {
      findMany: async () => state.cases.map(({ id }) => ({ id })),
      deleteMany: async ({ where }) => { const before = state.cases.length; state.cases = state.cases.filter(row => !where.id.in.includes(row.id)); return { count: before - state.cases.length }; },
    },
    message: { deleteMany: async ({ where }) => { state.messages = filter(state.messages, where); } },
    evidence: { deleteMany: async ({ where }) => { state.evidence = filter(state.evidence, where); } },
    generatedDocument: { deleteMany: async ({ where }) => { if (failOnDocumentDelete) throw new Error("simulated database failure"); state.documents = filter(state.documents, where); } },
  };
}
