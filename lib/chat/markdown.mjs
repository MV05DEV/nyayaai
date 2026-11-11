function unescapeMarkdown(value) {
  return value.replace(/\\([\\|*_#[\]()])/g, '$1');
}

function parseInline(text) {
  const result = [];
  const pattern = /\*\*(.+?)\*\*|\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g;
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor) result.push({ type: 'text', value: unescapeMarkdown(text.slice(cursor, index)) });
    if (match[1]) result.push({ type: 'bold', value: unescapeMarkdown(match[1]) });
    else result.push({ type: 'link', value: unescapeMarkdown(match[2]), href: match[3] });
    cursor = index + match[0].length;
  }
  if (cursor < text.length) result.push({ type: 'text', value: unescapeMarkdown(text.slice(cursor)) });
  return result;
}

function parseTableRow(line) {
  const cells = [];
  let cell = '';
  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    if (char === '\\' && index + 1 < line.length && ['\\', '|'].includes(line[index + 1])) {
      cell += line[++index];
    } else if (char === '|') {
      cells.push(cell.trim());
      cell = '';
    } else {
      cell += char;
    }
  }
  cells.push(cell.trim());
  if (line.trimStart().startsWith('|')) cells.shift();
  if (line.trimEnd().endsWith('|')) cells.pop();
  return cells.map(unescapeMarkdown);
}

function isTableSeparator(line) {
  const cells = parseTableRow(line);
  return cells.length > 0 && cells.every(cell => /^:?-{3,}:?$/.test(cell.replaceAll(' ', '')));
}

function isHorizontalRule(line) {
  return /^(?:-{3,}|\*{3,}|_{3,})$/.test(line.trim());
}

export function parseMarkdown(markdown) {
  const lines = markdown.replace(/\r/g, '').split('\n');
  const blocks = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) { index++; continue; }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length, children: parseInline(heading[2]) });
      index++;
      continue;
    }
    if (isHorizontalRule(line)) {
      blocks.push({ type: 'horizontal-rule' });
      index++;
      continue;
    }
    if (line.includes('|') && index + 1 < lines.length && isTableSeparator(lines[index + 1].trim())) {
      const headers = parseTableRow(line).map(parseInline);
      index += 2;
      const rows = [];
      while (index < lines.length && lines[index].trim().includes('|')) {
        rows.push(parseTableRow(lines[index].trim()).map(parseInline));
        index++;
      }
      blocks.push({ type: 'table', headers, rows });
      continue;
    }
    const list = line.match(/^(?:[-*+]\s+|\d+[.)]\s+)(.+)$/);
    if (list) {
      const ordered = /^\d+[.)]\s+/.test(line);
      const items = [];
      while (index < lines.length) {
        const item = lines[index].trim().match(ordered ? /^\d+[.)]\s+(.+)$/ : /^[-*+]\s+(.+)$/);
        if (!item) break;
        items.push(parseInline(item[1]));
        index++;
      }
      blocks.push({ type: ordered ? 'ordered-list' : 'unordered-list', items });
      continue;
    }
    const paragraph = [line];
    index++;
    while (index < lines.length && lines[index].trim() && !/^(?:#{1,3}\s+|[-*+]\s+|\d+[.)]\s+)/.test(lines[index].trim()) && !isHorizontalRule(lines[index].trim())) paragraph.push(lines[index++].trim());
    blocks.push({ type: 'paragraph', children: parseInline(paragraph.join(' ')) });
  }
  return blocks;
}
