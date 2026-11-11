export function getLegalQueryIntents(query) {
  const normalized = query.toLowerCase();
  const intents = new Set();
  if (/defective|defect|damaged|faulty|refund|seller refuses|seller reject/.test(normalized)) intents.add("defect-remedy");
  if (/nch|national consumer helpline|mandatory|prerequisite|must.*escalat/.test(normalized)) intents.add("nch-route");
  if (/e-?jagriti|online.*(file|filing)|file.*online|portal/.test(normalized)) intents.add("commission-filing");
  if (/fee|cost|65,?000|65000/.test(normalized)) intents.add("filing-fee");
  if (/territorial|which district|district commission|where.*file/.test(normalized)) intents.add("territorial-jurisdiction");
  return intents;
}

export function getDistrictFilingFeeForConsideration(considerationRupees) {
  if (!Number.isFinite(considerationRupees) || considerationRupees < 0) return null;
  if (considerationRupees <= 500000) return 0;
  if (considerationRupees <= 1000000) return 200;
  return null;
}
