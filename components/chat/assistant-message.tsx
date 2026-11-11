import { parseMarkdown, type InlineNode, type MarkdownBlock } from '@/lib/chat/markdown.mjs';

function InlineContent({ nodes }: { nodes: InlineNode[] }) {
  return <>{nodes.map((node, index) => {
    if (node.type === 'bold') return <strong key={index} className="font-semibold text-slate-900">{node.value}</strong>;
    if (node.type === 'link') return <a key={index} href={node.href} target="_blank" rel="noopener noreferrer" className="text-blue-800 underline decoration-blue-300 underline-offset-2">{node.value}</a>;
    return <span key={index}>{node.value}</span>;
  })}</>;
}

function MarkdownBlockView({ block }: { block: MarkdownBlock }) {
  if (block.type === 'horizontal-rule') return <hr className="my-5 border-slate-200"/>;
  if (block.type === 'table') return <div className="my-4 overflow-x-auto"><table className="w-full border-collapse text-left text-sm"><thead><tr>{block.headers.map((cell, index) => <th key={index} className="border-b border-slate-300 px-3 py-2 font-semibold text-slate-900"><InlineContent nodes={cell}/></th>)}</tr></thead><tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex} className="border-b border-slate-100 last:border-0">{block.headers.map((_, cellIndex) => <td key={cellIndex} className="px-3 py-2 align-top"><InlineContent nodes={row[cellIndex] || []}/></td>)}</tr>)}</tbody></table></div>;
  if (block.type === 'heading') {
    const Tag = `h${Math.min(block.level + 2, 4)}` as 'h3' | 'h4' | 'h5';
    return <Tag className="mb-2 mt-4 font-semibold leading-6 text-slate-900 first:mt-0"><InlineContent nodes={block.children}/></Tag>;
  }
  if (block.type === 'ordered-list' || block.type === 'unordered-list') {
    const Tag = block.type === 'ordered-list' ? 'ol' : 'ul';
    return <Tag className={`my-3 space-y-1.5 pl-5 ${block.type === 'ordered-list' ? 'list-decimal' : 'list-disc'}`}>{block.items.map((item, index) => <li key={index} className="pl-1"><InlineContent nodes={item}/></li>)}</Tag>;
  }
  if (block.type === 'paragraph') return <p className="my-2 leading-7 last:mb-0"><InlineContent nodes={block.children}/></p>;
  return null;
}

export function AssistantMessage({ content }: { content: string }) {
  return <div>{parseMarkdown(content).map((block, index) => <MarkdownBlockView key={index} block={block}/>)}</div>;
}
