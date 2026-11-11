import test from "node:test";
import assert from "node:assert/strict";
import { getDistrictFilingFeeForConsideration, getLegalQueryIntents } from "../lib/legal/query-intents.mjs";

test("defective laptop purchased online retrieves defect-remedy intent", () => {
  assert.ok(getLegalQueryIntents("I bought a defective laptop online").has("defect-remedy"));
});

test("seller refusal to refund retrieves defect-remedy intent", () => {
  assert.ok(getLegalQueryIntents("The seller refuses my refund").has("defect-remedy"));
});

test("NCH prerequisite question retrieves the separate NCH route", () => {
  assert.ok(getLegalQueryIntents("Is NCH escalation mandatory before filing?").has("nch-route"));
});

test("online Consumer Commission filing retrieves e-Jagriti guidance", () => {
  assert.ok(getLegalQueryIntents("How can I file a Consumer Commission case online?").has("commission-filing"));
});

test("filing fee for a 65000 dispute retrieves fee guidance", () => {
  assert.ok(getLegalQueryIntents("What is the filing fee for a ₹65,000 dispute?").has("filing-fee"));
});

test("₹65,000 consideration is in the nil District Commission fee band", () => {
  assert.equal(getDistrictFilingFeeForConsideration(65000), 0);
});

test("₹6 lakh consideration is in the ₹200 District Commission fee band", () => {
  assert.equal(getDistrictFilingFeeForConsideration(600000), 200);
});

test("invalid or unsupported consideration amounts do not produce fee estimates", () => {
  assert.equal(getDistrictFilingFeeForConsideration(-1), null);
  assert.equal(getDistrictFilingFeeForConsideration(1000001), null);
});

test("district selection question retrieves territorial-jurisdiction guidance", () => {
  assert.ok(getLegalQueryIntents("Which district has territorial jurisdiction for filing?").has("territorial-jurisdiction"));
});
