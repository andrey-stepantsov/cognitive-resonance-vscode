import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { MermaidDiagram } from './MermaidDiagram';

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ node, inline, className, children, ...props }: any) {
          const match = /language-(\w+)/.exec(className || '');
          const language = match ? match[1] : '';

          if (!inline && language === 'mermaid') {
            return (
              <MermaidDiagram chart={String(children).replace(/\n$/, '')} />
            );
          }

          return !inline && match ? (
            <div className="rounded-md overflow-hidden my-4 border border-zinc-700/50">
               <div className="bg-zinc-800/80 px-3 py-1.5 text-xs text-zinc-400 border-b border-zinc-700/50 flex justify-between items-center">
                 <span>{language}</span>
                 {/* Copy button can go here later */}
               </div>
              <SyntaxHighlighter
                {...props}
                style={vscDarkPlus as any}
                language={match[1]}
                PreTag="div"
                className="!m-0 !bg-zinc-900/50 text-sm"
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            </div>
          ) : (
            <code {...props} className={`${className} bg-zinc-800 text-zinc-200 px-1 py-0.5 rounded text-sm font-mono`}>
              {children}
            </code>
          );
        }
      }}
    >
      {content}
    </ReactMarkdown>
  );
};
