import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { Copy, Check, Maximize2, Minimize2 } from 'lucide-react';
import { createPortal } from 'react-dom';

interface MermaidDiagramProps {
  chart: string;
}

export const MermaidDiagram: React.FC<MermaidDiagramProps> = ({ chart }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      securityLevel: 'strict',
      fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif',
    });
  }, []);

  useEffect(() => {
    let isMounted = true;

    const renderDiagram = async () => {
      if (!chart || chart.trim() === '') return;
      
      // Sanitize common AI-generated Mermaid syntax errors
      const sanitizeMermaid = (chartCode: string): string => {
        if (!chartCode) return chartCode;

        let result = chartCode;

        // 1. Remove stray double-quotes around arrow targets/sources.
        //    AI often generates: -->"B(Process 1") or A --> "B"
        //    But preserve valid quotes INSIDE brackets: A["Label"], B{"Choice"}
        result = result.replace(/(-->|---|-\.-|==>)\s*"([^"]*?)"/g, '$1 $2');
        result = result.replace(/"([^"]*?)"\s*(-->|---|-\.-|==>)/g, '$1 $2');

        // 2. Quote node labels that contain parentheses with spaces
        //    e.g. B(Process 1) -> B["Process 1"] since () is a shape delimiter
        result = result.replace(/([A-Za-z0-9_]+)\(([^)]*\s[^)]*)\)/g, (_match, id, text) => {
          return `${id}["${text}"]`;
        });

        // 3. Fix decision nodes with special chars that need quoting
        result = result.replace(/([A-Za-z0-9_]+)\{([^}]*[`()][^}]*)\}/g, (_match, id, text) => {
          const clean = text.replace(/"/g, "'");
          return `${id}{"${clean}"}`;
        });

        return result;
      };

      try {
        setError(null);
        const id = `mermaid-container-${Math.random().toString(36).substring(2, 9)}`;
        const safeChart = sanitizeMermaid(chart);
        const { svg } = await mermaid.render(id, safeChart);
        
        if (isMounted) {
          setSvgContent(svg);
        }
      } catch (e: any) {
        if (isMounted) {
          console.error("Mermaid rendering failed:", e);
          setError(e.message || "Failed to render diagram.");
        }
      }
    };

    renderDiagram();

    return () => {
      isMounted = false;
    };
  }, [chart]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(chart);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = chart;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (error) {
    return (
      <div className="mermaid-error bg-red-900/20 border justify-center border-red-500/50 p-4 rounded-md my-4">
        <div className="text-red-400 font-semibold mb-2">Mermaid Syntax Error</div>
        <pre className="text-red-300 text-sm overflow-x-auto whitespace-pre-wrap">{error}</pre>
        <div className="mt-4 text-xs text-zinc-400">Original syntax:</div>
        <pre className="text-zinc-500 text-xs overflow-x-auto mt-1">{chart}</pre>
      </div>
    );
  }

  return (
    <>
      {isFullscreen && document.body && createPortal(
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex flex-col p-4 sm:p-8 animate-in fade-in duration-200">
          <div className="flex justify-between items-center bg-zinc-900 border border-zinc-700/50 rounded-t-lg px-4 py-3">
            <span className="text-zinc-300 font-medium">Mermaid Diagram (Fullscreen)</span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 transition-colors"
              >
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied' : 'Copy Source'}
              </button>
              <button
                onClick={() => setIsFullscreen(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-zinc-300 hover:text-white bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 transition-colors"
              >
                <Minimize2 className="w-4 h-4" />
                Close Fullscreen
              </button>
            </div>
          </div>
          <div 
            className="flex-1 overflow-auto bg-zinc-950 border border-t-0 border-zinc-700/50 rounded-b-lg flex items-center justify-center p-8"
            dangerouslySetInnerHTML={{ __html: svgContent }} 
          />
        </div>,
        document.body
      )}
      
      <div className="relative group my-6 w-full max-w-full min-w-0 overflow-hidden rounded-lg border border-zinc-700/50 bg-zinc-900/10">
        <div className="bg-zinc-800/80 px-3 py-1.5 text-xs text-zinc-400 border-b border-zinc-700/50 flex justify-between items-center w-full">
          <span>mermaid</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsFullscreen(true)}
              className="p-1.5 rounded text-zinc-500 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors"
              title="View fullscreen"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            <div className="w-px h-4 bg-zinc-700 mx-1"></div>
            <button
              onClick={handleCopy}
              className="p-1.5 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700/50 transition-colors"
              title={copied ? 'Copied!' : 'Copy diagram source'}
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
        <div 
          ref={containerRef}
          className="mermaid-diagram flex justify-center py-4 bg-zinc-900/30 overflow-x-auto w-full max-w-full min-w-0 print:hidden cursor-zoom-in"
          onClick={() => setIsFullscreen(true)}
          dangerouslySetInnerHTML={{ __html: svgContent }} 
        />
      </div>
    </>
  );
};
