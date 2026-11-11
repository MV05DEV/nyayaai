import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMarkdown } from '../lib/chat/markdown.mjs';

test('parses assistant markdown headings, bold text, lists, paragraphs and safe links', () => {
  const blocks = parseMarkdown('## Heading\n\nA **clear** paragraph with [official source](https://example.gov.in/page).\n\n- One\n- Two\n\n1. First\n2. Second');
  assert.equal(blocks[0].type, 'heading');
  assert.deepEqual(blocks[1].children.map(node => node.type), ['text', 'bold', 'text', 'link', 'text']);
  assert.equal(blocks[2].type, 'unordered-list');
  assert.equal(blocks[2].items.length, 2);
  assert.equal(blocks[3].type, 'ordered-list');
  assert.equal(blocks[3].items.length, 2);
});

test('renders unsafe schemes as plain text rather than links', () => {
  const blocks = parseMarkdown('[unsafe](javascript:alert(1))');
  assert.equal(blocks[0].children.every(node => node.type !== 'link'), true);
});

test('parses Markdown tables, escaped pipes, and horizontal rules as structure', () => {
  const blocks = parseMarkdown('| **Party** | Role |\n| --- | :---: |\n| Maker | Manufacturer \\| brand owner |\n\n---\n\nNext paragraph');
  assert.equal(blocks[0].type, 'table');
  assert.equal(blocks[0].headers[0][0].type, 'bold');
  assert.equal(blocks[0].rows[0][1][0].value, 'Manufacturer | brand owner');
  assert.equal(blocks[1].type, 'horizontal-rule');
  assert.equal(blocks[2].type, 'paragraph');
});

test('unescapes markdown punctuation instead of showing escape slashes', () => {
  const blocks = parseMarkdown('Use \\| as a separator and a literal \\\\ path.');
  assert.match(blocks[0].children.map(node => node.value || '').join(''), /Use \| as a separator and a literal \\ path\./);
});
