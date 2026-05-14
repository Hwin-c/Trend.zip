import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { NodeData } from '../types';
import ForceGraph2D from 'react-force-graph-2d';

interface ConstellationProps {
  nodes: NodeData[];
  centerNode?: NodeData;
  onNodeClick: (node: NodeData) => void;
  activeNodeId?: string;
}

// Helper to draw a literal 5-pointed star
const draw5PointStar = (ctx: CanvasRenderingContext2D, cx: number, cy: number, outerRadius: number, innerRadius: number) => {
  let rot = (Math.PI / 2) * 3;
  let x = cx;
  let y = cy;
  const step = Math.PI / 5;

  ctx.beginPath();
  ctx.moveTo(cx, cy - outerRadius);
  for (let i = 0; i < 5; i++) {
    x = cx + Math.cos(rot) * outerRadius;
    y = cy + Math.sin(rot) * outerRadius;
    ctx.lineTo(x, y);
    rot += step;

    x = cx + Math.cos(rot) * innerRadius;
    y = cy + Math.sin(rot) * innerRadius;
    ctx.lineTo(x, y);
    rot += step;
  }
  ctx.lineTo(cx, cy - outerRadius);
  ctx.closePath();
};

export const Constellation: React.FC<ConstellationProps> = ({ nodes, centerNode, onNodeClick, activeNodeId }) => {
  const fgRef = useRef<any>();
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [hoverNode, setHoverNode] = useState<string | null>(null);

  // Handle Resize
  useEffect(() => {
    const handleResize = () => setDimensions({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Generate Data for ForceGraph
  const graphData = useMemo(() => {
    // Spawn nodes close to 0,0 to naturally cluster them
    const fgNodes = nodes.map(n => ({ 
      ...n, 
      x: (Math.random() - 0.5) * 50,
      y: (Math.random() - 0.5) * 50,
      val: n.type === 'big_genre' ? 2 : 1 
    }));
    const fgLinks: any[] = [];

    if (centerNode) {
      // Sub-genre view: Starburst from center
      fgNodes.forEach(n => {
        if (n.id !== centerNode.id) {
          fgLinks.push({ source: centerNode.id, target: n.id, isStructural: false });
        }
      });
    } else {
      // Root Explore View: Draw beautiful static constellations for big genres
      let currentGroupStart = 0;
      while (currentGroupStart < fgNodes.length) {
        const groupSize = Math.floor(Math.random() * 3) + 4; // 4 to 6 nodes per group
        const groupEnd = Math.min(currentGroupStart + groupSize, fgNodes.length);
        
        // Connect them linearly
        for (let i = currentGroupStart; i < groupEnd - 1; i++) {
          fgLinks.push({ source: fgNodes[i].id, target: fgNodes[i+1].id, isStructural: true });
        }
        
        // Add a branching line to make it look like a real constellation
        if (groupSize >= 5 && currentGroupStart + 2 < groupEnd) {
          fgLinks.push({ source: fgNodes[currentGroupStart].id, target: fgNodes[currentGroupStart + 2].id, isStructural: true });
        }

        currentGroupStart = groupEnd;
      }
    }

    return { nodes: fgNodes, links: fgLinks };
  }, [nodes, centerNode]);

  // Force Engine configuration
  useEffect(() => {
    if (fgRef.current) {
      if (centerNode) {
        // High repulsion and larger link distance so children spread out widely like the root view
        fgRef.current.d3Force('charge').strength(-800).distanceMax(1200); 
        fgRef.current.d3Force('center').strength(0); 
        fgRef.current.d3Force('link').distance(250);
      } else {
        // Root view: distanceMax stops infinite repelling, keeping the distinct groups clustered in the center screen
        fgRef.current.d3Force('charge').strength(-100).distanceMax(250); 
        fgRef.current.d3Force('center').strength(0.05);
        fgRef.current.d3Force('link').distance(60);
      }
    }
  }, [graphData, centerNode]);

  // Custom Canvas Rendering for literal stars
  const drawNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const label = node.name;
    const isActive = node.id === activeNodeId;
    const isHovered = node.id === hoverNode;
    const isCenter = centerNode && node.id === centerNode.id;
    const isBig = node.type === 'big_genre' || isCenter;

    // Radius logic
    const baseOuterRadius = isBig ? 6 : 3; 
    const baseInnerRadius = isBig ? 2.5 : 1.2;
    
    // Twinkling effect
    const time = Date.now();
    const twinkleOffset = node.id.charCodeAt(0) * 100;
    const twinkle = Math.sin((time + twinkleOffset) / 500) * 0.2 + 0.8; // 0.6 to 1.0
    const multiplier = isActive || isHovered ? 1.5 : twinkle;

    const outerRadius = baseOuterRadius * multiplier;
    const innerRadius = baseInnerRadius * multiplier;

    // Color variation
    let coreColor = '#FFFFFF';
    let flareColor = 'rgba(255, 255, 255, ';
    if (node.type === 'big_genre') {
      coreColor = '#E0F2FE'; // Light Blueish white
      flareColor = 'rgba(224, 242, 254, ';
    } else if (node.type === 'song') {
      coreColor = '#A7F3D0'; // Light Green
      flareColor = 'rgba(167, 243, 208, ';
    } else {
      coreColor = '#FFFFFF'; // Pure white
      flareColor = 'rgba(255, 255, 255, ';
    }

    // Draw glowing soft halo behind the star
    const glowRadius = outerRadius * (isBig ? 4 : 3);
    const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, glowRadius);
    gradient.addColorStop(0, flareColor + (isActive || isHovered ? '0.6)' : (isBig ? '0.3)' : '0.15)')));
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    
    ctx.beginPath();
    ctx.arc(node.x, node.y, glowRadius, 0, 2 * Math.PI, false);
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw the literal 5-pointed star
    draw5PointStar(ctx, node.x, node.y, outerRadius, innerRadius);
    ctx.fillStyle = isActive ? '#FFFFFF' : coreColor;
    ctx.fill();

    // Draw text label
    const fontSize = isBig ? 14 / globalScale : 8 / globalScale; 
    ctx.font = `300 ${fontSize}px "Inter", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top'; 
    
    // Text Shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 4 / globalScale;
    ctx.shadowOffsetX = 1 / globalScale;
    ctx.shadowOffsetY = 1 / globalScale;

    ctx.fillStyle = isActive || isHovered ? '#FFFFFF' : (isBig ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.6)');
    ctx.fillText(label, node.x, node.y + outerRadius + (4 / globalScale));
    
    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }, [activeNodeId, centerNode, hoverNode]);

  return (
    <div className="absolute inset-0 w-full h-full z-10 cursor-move">
      <ForceGraph2D
        ref={fgRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={graphData}
        nodeLabel={() => ''} 
        nodeCanvasObject={drawNode}
        linkColor={(link: any) => {
          // Structural lines (between big genres) NEVER highlight on hover
          if (link.isStructural) return 'rgba(224, 231, 255, 0.2)'; 
          
          const isHighlight = hoverNode && (link.source.id === hoverNode || link.target.id === hoverNode);
          return isHighlight ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.2)';
        }}
        linkWidth={(link: any) => {
          if (link.isStructural) return 0.5; // Never thicken structural lines
          return hoverNode && (link.source.id === hoverNode || link.target.id === hoverNode) ? 1.5 : 0.5;
        }}
        onNodeClick={(node) => onNodeClick(node as NodeData)}
        onNodeHover={(node) => setHoverNode(node ? (node as NodeData).id : null)}
        enableNodeDrag={true}
        enableZoomInteraction={true}
        enablePanInteraction={true}
        minZoom={0.2}
        maxZoom={4}
        cooldownTicks={100}
        onEngineStop={() => {
          if (fgRef.current) {
            if (centerNode) {
              // Instead of zoomToFit which might zoom way out, use a fixed, zoomed-in scale
              fgRef.current.centerAt(0, 0, 600);
              fgRef.current.zoom(1.2, 600); 
            } else {
              fgRef.current.zoomToFit(600, 100); 
            }
          }
        }}
      />
    </div>
  );
};
