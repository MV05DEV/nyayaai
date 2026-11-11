const citationPattern = /\b(Section|Rule)\s+\d+(?:\s*\(\s*\d+\s*\))*/gi;
const internalIdPattern = /\b(?:ECOM\d{4}-R\d+|CPA\d{4}-S[\d-]+|PROCEDURE-[A-Z0-9-]+)\b/gi;

function canonical(reference) {
  return reference.replace(/\s+/g, '').toLowerCase();
}

function isUsable(chunk) {
  return !/unsupported|unverified|not verified|source uncertain/i.test(chunk.note || '');
}

function markdownCitation(chunk, reference) {
  return `[${chunk.sourceTitle}, ${reference}](${chunk.sourceUrl})`;
}

export function formatLegalCitations(text, retrievedChunks) {
  const unsupportedMarker = '\uE000';
  const chunks = retrievedChunks.filter(isUsable);
  let removed = false;
  const byId = new Map(chunks.map(chunk => [chunk.id.toLowerCase(), chunk]));
  const byReference = new Map();
  for (const chunk of chunks) {
    const sourceText = `${chunk.sectionReference} ${chunk.title} ${chunk.content}`;
    for (const match of sourceText.matchAll(citationPattern)) {
      const key = canonical(match[0]);
      if (!byReference.has(key)) byReference.set(key, chunk);
    }
  }

  let formatted = text;
  formatted = formatted.replace(/\[([^\]]*\b(?:Section|Rule)\s+\d+(?:\s*\(\s*\d+\s*\))?[^\]]*)\]\((https?:\/\/[^)]+)\)/gi, (link, label) => {
    const citation = label.match(citationPattern)?.[0];
    const chunk = citation ? byReference.get(canonical(citation)) : undefined;
    if (!chunk) {
      removed = true;
      return unsupportedMarker;
    }
    return markdownCitation(chunk, citation.replace(/\s+/g, ' '));
  });
  formatted = formatted.replace(citationPattern, (citation, _kind, offset, whole) => {
    const before = whole.slice(0, offset);
    const after = whole.slice(offset + citation.length);
    if (before.lastIndexOf('[') > before.lastIndexOf(']') && after.startsWith('](')) return citation;
    const chunk = byReference.get(canonical(citation));
    if (!chunk) {
      removed = true;
      return unsupportedMarker;
    }
    return markdownCitation(chunk, citation.replace(/\s+/g, ' '));
  });
  formatted = formatted.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, (link, label) => {
    const id = label.match(internalIdPattern)?.[0];
    if (!id) return link;
    const chunk = byId.get(id.toLowerCase());
    if (!chunk) {
      removed = true;
      return unsupportedMarker;
    }
    return markdownCitation(chunk, chunk.sectionReference);
  });
  formatted = formatted.replace(internalIdPattern, id => {
    const chunk = byId.get(id.toLowerCase());
    if (!chunk) removed = true;
    return chunk ? markdownCitation(chunk, chunk.sectionReference) : unsupportedMarker;
  });
  formatted = formatted.replace(/\[legal citation omitted because no supporting source was retrieved\]/gi, '');
  formatted = formatted.split('\n').filter(line => !line.includes(unsupportedMarker)).join('\n').replaceAll(unsupportedMarker, '');
  formatted = formatted.replace(/(\[[^\]]+\]\(https?:\/\/[^)\s]+\))\s+\(\1\)/g, '$1');
  formatted = formatted.replace(/[ \t]{2,}/g, ' ').replace(/\s+([,.;])/g, '$1');
  return { text: formatted.trim(), removed };
}
