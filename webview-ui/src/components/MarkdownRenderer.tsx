import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { MermaidDiagram } from './MermaidDiagram';
import { Copy, Check } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for environments without clipboard API
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700/50 transition-colors"
      title={copied ? 'Copied!' : 'Copy'}
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  // Normalize literal '\n' sequences that might have been double-escaped by the LLM JSON output
  const normalizedContent = content.replace(/\\n/g, '\n');

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        pre({ children }: any) {
          // In react-markdown v10, block code is <pre><code>. 
          // Return children directly so our code() handler renders the block.
          return <>{children}</>;
        },
        code({ node, className, children, ...props }: any) {
          const match = /language-(\w+)/.exec(className || '');
          const language = match ? match[1] : '';
          const codeStr = String(children).replace(/\n$/, '');

          // Block-level code has a className like "language-xxx"
          if (match && language === 'mermaid') {
            return (
              <MermaidDiagram chart={codeStr} />
            );
          }

          if (match) {
            return (
              <div className="rounded-md overflow-hidden my-4 border border-zinc-700/50 w-full max-w-full min-w-0">
                 <div className="bg-zinc-800/80 px-3 py-1.5 text-xs text-zinc-400 border-b border-zinc-700/50 flex justify-between items-center w-full">
                   <span>{language}</span>
                   <CopyButton text={codeStr} />
                 </div>
                <SyntaxHighlighter
                  style={vscDarkPlus as any}
                  language={match[1]}
                  PreTag="div"
                  customStyle={{ margin: 0, padding: '1rem', background: 'transparent' }}
                  codeTagProps={{ style: { background: 'transparent' } }}
                  className="!m-0 text-sm"
                >
                  {codeStr}
                </SyntaxHighlighter>
              </div>
            );
          }

          return (
            <code {...props} className={`${className || ''} bg-zinc-800 text-zinc-200 px-1 py-0.5 rounded text-sm font-mono`}>
              {children}
            </code>
          );
        }
      }}
    >
      {normalizedContent}
    </ReactMarkdown>
  );
};

