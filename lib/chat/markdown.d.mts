export type InlineNode = { type: 'text' | 'bold'; value: string } | { type: 'link'; value: string; href: string };
export type MarkdownBlock =
  | { type: 'heading'; level: number; children: InlineNode[] }
  | { type: 'paragraph'; children: InlineNode[] }
  | { type: 'ordered-list' | 'unordered-list'; items: InlineNode[][] }
  | { type: 'horizontal-rule' }
  | { type: 'table'; headers: InlineNode[][]; rows: InlineNode[][][] };
export function parseMarkdown(markdown: string): MarkdownBlock[];
