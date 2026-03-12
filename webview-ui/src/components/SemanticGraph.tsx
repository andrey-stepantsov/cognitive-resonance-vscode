import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as d3 from 'd3';
import { Maximize2, Minimize2 } from 'lucide-react';

export interface Node {
  id: string;
  label: string;
  weight: number;
}

export interface Edge {
  source: string;
  target: string;
  label: string;
}

interface SemanticGraphProps {
  nodes: Node[];
  edges: Edge[];
  onNodeClick?: (nodeId: string) => void;
}

export const SemanticGraph: React.FC<SemanticGraphProps> = ({ nodes, edges, onNodeClick }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return;

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // Deep copy to avoid mutating props
    const graphNodes = nodes.map(d => ({ ...d }));
    
    // Defensive Filter: Ensure all edges point to valid nodes to prevent D3 calculation crashes
    const validNodeIds = new Set(graphNodes.map(n => n.id));
    const validEdges = edges.filter(e => validNodeIds.has(e.source) && validNodeIds.has(e.target));
    const graphEdges = validEdges.map(d => ({ ...d }));

    const simulation = d3.forceSimulation(graphNodes as any)
      .force("link", d3.forceLink(graphEdges).id((d: any) => d.id).distance(120))
      .force("charge", d3.forceManyBody().strength(-400))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius((d: any) => (d.weight || 5) * 3 + 15));

    const link = svg.append("g")
      .attr("stroke", "#52525b") // zinc-600
      .attr("stroke-opacity", 0.6)
      .selectAll("line")
      .data(graphEdges)
      .join("line")
      .attr("stroke-width", 1.5);

    const linkLabel = svg.append("g")
      .attr("class", "link-labels")
      .selectAll("text")
      .data(graphEdges)
      .join("text")
      .attr("font-size", "10px")
      .attr("fill", "#a1a1aa") // zinc-400
      .attr("text-anchor", "middle")
      .text((d: any) => d.label);

    const node = svg.append("g")
      .attr("stroke", "#18181b") // zinc-900
      .attr("stroke-width", 1.5)
      .selectAll("circle")
      .data(graphNodes)
      .join("circle")
      .attr("r", (d: any) => (d.weight || 5) * 2 + 5)
      .attr("fill", "#6366f1") // indigo-500
      .call(drag(simulation) as any)
      .on("click", (event: any, d: any) => {
         if (onNodeClick) {
           onNodeClick(d.id);
         }
      })
      .style("cursor", onNodeClick ? "pointer" : "default");

    const label = svg.append("g")
      .attr("class", "labels")
      .selectAll("text")
      .data(graphNodes)
      .join("text")
      .attr("font-size", "12px")
      .attr("font-weight", "500")
      .attr("fill", "#e4e4e7") // zinc-200
      .attr("dx", 12)
      .attr("dy", 4)
      .text((d: any) => d.label);

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      linkLabel
        .attr("x", (d: any) => (d.source.x + d.target.x) / 2)
        .attr("y", (d: any) => (d.source.y + d.target.y) / 2);

      node
        .attr("cx", (d: any) => Math.max(10, Math.min(width - 10, d.x)))
        .attr("cy", (d: any) => Math.max(10, Math.min(height - 10, d.y)));

      label
        .attr("x", (d: any) => Math.max(10, Math.min(width - 10, d.x)))
        .attr("y", (d: any) => Math.max(10, Math.min(height - 10, d.y)));
    });

    function drag(simulation: d3.Simulation<any, any>) {
      function dragstarted(event: any) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
      }

      function dragged(event: any) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
      }

      function dragended(event: any) {
        if (!event.active) simulation.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
      }

      return d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended);
    }

    return () => {
      simulation.stop();
    };
  }, [nodes, edges, isFullscreen]);

  const content = (
    <div className={
      isFullscreen
        ? "fixed inset-0 z-[100] bg-zinc-950/95 backdrop-blur-sm p-4 md:p-8 flex flex-col"
        : "w-full h-full flex-1 min-h-[300px] overflow-hidden rounded-xl bg-zinc-950/50 border border-zinc-800/50 relative group"
    }>
      <button 
        onClick={() => setIsFullscreen(!isFullscreen)}
        className={`fixed md:absolute top-2 right-2 p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors z-[110] ${!isFullscreen ? 'opacity-0 group-hover:opacity-100' : ''}`}
        title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
      >
        {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
      </button>

      <div className={`relative ${isFullscreen ? 'w-full h-full flex-1 border border-zinc-800/50 rounded-xl overflow-hidden bg-zinc-950/50' : 'w-full h-full absolute inset-0'}`}>
        <svg ref={svgRef} className="w-full h-full absolute inset-0" />
        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-zinc-500 text-sm">
            No semantic markers yet
          </div>
        )}
      </div>
    </div>
  );

  return isFullscreen ? createPortal(content, document.body) : content;
};
