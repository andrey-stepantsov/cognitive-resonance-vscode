import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

interface MermaidDiagramProps {
  chart: string;
}

export const MermaidDiagram: React.FC<MermaidDiagramProps> = ({ chart }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Re-initialize mermaid when component is loaded or theme changes (though we hardcode dark here)
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
      
      try {
        setError(null);
        // Generate a pseudo-random ID for the SVG to avoid DOM conflicts
        const id = `mermaid-container-${Math.random().toString(36).substring(2, 9)}`;
        
        // mermaid.render returns an object with svg (the HTML string)
        const { svg } = await mermaid.render(id, chart);
        
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
    <div 
      ref={containerRef}
      className="mermaid-diagram flex justify-center py-4 my-6 bg-zinc-900/30 rounded-lg border border-zinc-800/50 overflow-x-auto print:hidden"
      dangerouslySetInnerHTML={{ __html: svgContent }} 
    />
  );
};
