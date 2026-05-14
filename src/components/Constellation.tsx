import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { NodeData } from '../types';
import ForceGraph2D from 'react-force-graph-2d';
import { forceCollide } from 'd3-force';

interface ConstellationProps {
  nodes: NodeData[];
  centerNode?: NodeData;
  onNodeClick: (node: NodeData) => void;
  activeNodeId?: string;
  /** Callback when node positions have settled after simulation */
  onPositionsSettled?: (positions: Map<string, { x: number; y: number }>) => void;
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

export const Constellation: React.FC<ConstellationProps> = ({ nodes, centerNode, onNodeClick, activeNodeId, onPositionsSettled }) => {
  const fgRef = useRef<any>();
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [hoverNode, setHoverNode] = useState<string | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const settledReportedRef = useRef<boolean>(false);

  // Reset reported flag when nodes change
  useEffect(() => {
    settledReportedRef.current = false;
  }, [nodes]);

  // Handle Resize
  useEffect(() => {
    const handleResize = () => setDimensions({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);



  // Generate Data for ForceGraph
  const graphData = useMemo(() => {
    const fgNodes = nodes.map(n => ({
      ...n,
      // Spread initial coordinates wide so physics can separate them
      x: (n as any)._fx ?? (n as any).x ?? (Math.random() - 0.5) * 400,
      y: (n as any)._fy ?? (n as any).y ?? (Math.random() - 0.5) * 400,
      // Fixed positions if provided (for cached nodes)
      fx: (n as any)._fx ?? undefined,
      fy: (n as any)._fy ?? undefined,
      // Birth time for fade-in effect. Retain existing to prevent full-screen fade-in.
      _birthTime: (n as any)._birthTime,
      val: n.type === 'big_genre' ? 2 : 1
    }));
    const fgLinks: any[] = [];

    if (centerNode) {
      const songNodes = fgNodes.filter(n => n.type === 'song');

      if (songNodes.length > 10) {
        // Song tab: chain + branch structure to prevent 50 nodes collapsing to center
        songNodes.forEach((n, i) => {
          if (i === 0) {
            fgLinks.push({ source: centerNode.id, target: n.id, isStructural: false });
          } else {
            fgLinks.push({ source: songNodes[i - 1].id, target: n.id, isStructural: false });
          }
          // Branch back to center every 5 songs for star-like spread
          if (i > 0 && i % 5 === 0) {
            fgLinks.push({ source: centerNode.id, target: n.id, isStructural: false });
          }
        });
      } else {
        // Genre tab: radial starburst
        fgNodes.forEach(n => {
          if (n.id !== centerNode.id) {
            fgLinks.push({ source: centerNode.id, target: n.id, isStructural: false });
          }
        });
      }
    } else {
      // Root Explore View
      const bigGenres = fgNodes.filter(n => n.type === 'big_genre');
      const subGenres = fgNodes.filter(n => n.type === 'sub_genre');

      // Draw constellation groupings for big genres
      let currentGroupStart = 0;
      while (currentGroupStart < bigGenres.length) {
        const groupSize = Math.floor(Math.random() * 3) + 4;
        const groupEnd = Math.min(currentGroupStart + groupSize, bigGenres.length);

        for (let i = currentGroupStart; i < groupEnd - 1; i++) {
          fgLinks.push({ source: bigGenres[i].id, target: bigGenres[i + 1].id, isStructural: true });
        }

        if (groupSize >= 5 && currentGroupStart + 2 < groupEnd) {
          fgLinks.push({ source: bigGenres[currentGroupStart].id, target: bigGenres[currentGroupStart + 2].id, isStructural: true });
        }

        currentGroupStart = groupEnd;
      }

      // Connect sub-genres to their parent big_genre
      subGenres.forEach(sg => {
        if ((sg as any).parentId) {
          fgLinks.push({ source: (sg as any).parentId, target: sg.id, isStructural: false, isOrbit: true });
        }
      });
    }

    return { nodes: fgNodes, links: fgLinks };
  }, [nodes, centerNode]);

  // Force Engine configuration
  useEffect(() => {
    if (fgRef.current) {
      // Collision force — prevent nodes from overlapping
      fgRef.current.d3Force('collide',
        forceCollide()
          .radius((node: any) => {
            const isBig = node.type === 'big_genre';
            const labelLen = (node.name || '').length;
            // Big genres get largest space. Sub-genres and Songs get smaller padding unless they are the center node
            let baseRadius = 10;
            if (isBig || node.id === centerNode?.id) baseRadius = 30;
            else if (node.type === 'song') baseRadius = 15;
            
            // Only big genres or the active center node get label padding
            return (isBig || node.id === centerNode?.id) ? baseRadius + labelLen * 2 : baseRadius;
          })
          .strength(0.8)
          .iterations(3)
      );

      if (centerNode) {
        const hasManySongs = graphData.nodes.filter(n => n.type === 'song').length > 10;
        if (hasManySongs) {
          fgRef.current.d3Force('charge').strength(-800).distanceMax(1000); // Less repulsion for songs
          fgRef.current.d3Force('center').strength(0.03); // Slightly stronger gravity
          fgRef.current.d3Force('link').distance(100); // Narrower link distance for songs
        } else {
          fgRef.current.d3Force('charge').strength(-1200).distanceMax(1500); // Massive repulsion for detail view (genres)
          fgRef.current.d3Force('center').strength(0.01); // Weak center gravity
          fgRef.current.d3Force('link').distance(300); // Long distance links
        }
      } else {
        fgRef.current.d3Force('charge').strength(-300).distanceMax(500); // Weaker repulsion for explore view so it stays compact
        fgRef.current.d3Force('center').strength(0.04);
        fgRef.current.d3Force('link').distance((link: any) => {
          return link.isOrbit ? 30 : 100; // Compact distances: Orbit 30, Constellation 100
        });
      }
    }
  }, [graphData, centerNode]);

  // Custom Canvas Rendering — stars with fade-in glow
  const drawNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const label = node.name || '';
    const isActive = node.id === activeNodeId;
    const isHovered = node.id === hoverNode;
    const isCenter = centerNode && node.id === centerNode.id;
    const isBig = node.type === 'big_genre' || isCenter;

    // Fade-in based on _birthTime
    let fadeAlpha = 1;
    if (node._birthTime) {
      const elapsed = Date.now() - node._birthTime;
      fadeAlpha = Math.min(elapsed / 1500, 1); // 1.5s fade-in
    }

    // Radius logic
    const baseOuterRadius = isBig ? 6 : 3;
    const baseInnerRadius = isBig ? 2.5 : 1.2;

    // Twinkling effect — slow and subtle
    const time = Date.now();
    const twinkleOffset = (node.id?.charCodeAt(0) || 0) * 100;
    const twinkle = Math.sin((time + twinkleOffset) / 1500) * 0.15 + 0.85;
    const multiplier = isActive || isHovered ? 1.5 : twinkle;

    const outerRadius = baseOuterRadius * multiplier;
    const innerRadius = baseInnerRadius * multiplier;

    // Color variation by type
    let coreColor = '#FFFFFF';
    let flareColor = 'rgba(255, 255, 255, ';
    if (node.type === 'big_genre') {
      coreColor = '#E0F2FE';
      flareColor = 'rgba(224, 242, 254, ';
    } else if (node.type === 'song') {
      coreColor = '#A7F3D0';
      flareColor = 'rgba(167, 243, 208, ';
    }

    ctx.globalAlpha = fadeAlpha;

    // Draw glowing soft halo
    const glowRadius = outerRadius * (isBig ? 4 : 3);
    const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, glowRadius);
    gradient.addColorStop(0, flareColor + (isActive || isHovered ? '0.6)' : (isBig ? '0.3)' : '0.15)')));
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.beginPath();
    ctx.arc(node.x, node.y, glowRadius, 0, 2 * Math.PI, false);
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw the 5-pointed star
    draw5PointStar(ctx, node.x, node.y, outerRadius, innerRadius);
    ctx.fillStyle = isActive ? '#FFFFFF' : coreColor;
    ctx.fill();

    // Draw text label with background box for readability
    // Use fixed font size in canvas coordinates so it scales naturally with zoom
    // Reduced font size further
    const baseFontSize = isBig ? 18 : 11; 
    const minReadableScreenSize = 5; // minimum pixels on screen to draw text
    
    // Label Visibility Control: Show if it's large enough on screen, or if hovered/active
    const showLabel = (baseFontSize * globalScale >= minReadableScreenSize) || isActive || isHovered || isBig;

    if (showLabel) {
      ctx.font = `300 ${baseFontSize}px "Inter", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      const textY = node.y + outerRadius + 8;
      const textWidth = ctx.measureText(label).width;
      const pad = 6;

      // Semi-transparent background box behind text
      ctx.fillStyle = `rgba(0, 0, 0, ${0.5 * fadeAlpha})`;
      ctx.fillRect(
        node.x - textWidth / 2 - pad,
        textY - pad / 2,
        textWidth + pad * 2,
        baseFontSize + pad
      );

      // Text shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;

      ctx.fillStyle = isActive || isHovered ? '#FFFFFF' : (isBig ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.7)');
      ctx.fillText(label, node.x, textY);

      // Reset shadow & alpha
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }

    ctx.globalAlpha = 1;
  }, [activeNodeId, centerNode, hoverNode]);

  // Link color with fade-in sync
  const getLinkColor = useCallback((link: any) => {
    const sourceAlpha = link.source?._birthTime
      ? Math.min((Date.now() - link.source._birthTime) / 1500, 1) : 1;
    const targetAlpha = link.target?._birthTime
      ? Math.min((Date.now() - link.target._birthTime) / 1500, 1) : 1;
    const baseAlpha = Math.min(sourceAlpha, targetAlpha);

    if (link.isStructural) return `rgba(224, 231, 255, ${0.2 * baseAlpha})`;

    const isHighlight = hoverNode && (link.source.id === hoverNode || link.target.id === hoverNode);
    return isHighlight
      ? `rgba(255, 255, 255, ${0.8 * baseAlpha})`
      : `rgba(255, 255, 255, ${0.2 * baseAlpha})`;
  }, [hoverNode]);

  return (
    <div className="absolute inset-0 w-full h-full z-10 cursor-move">
      <ForceGraph2D
        ref={fgRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={graphData}
        nodeLabel={() => ''}
        nodeCanvasObject={drawNode}
        linkColor={getLinkColor}
        linkWidth={(link: any) => {
          if (link.isStructural) return 0.5;
          return hoverNode && (link.source.id === hoverNode || link.target.id === hoverNode) ? 1.5 : 0.5;
        }}
        onNodeClick={(node) => onNodeClick(node as NodeData)}
        onNodeHover={(node) => setHoverNode(node ? (node as NodeData).id : null)}
        enableNodeDrag={true}
        enableZoomInteraction={true}
        enablePanInteraction={true}
        minZoom={0.2}
        maxZoom={4}
        d3VelocityDecay={0.4}
        warmupTicks={200}
        cooldownTicks={100}
        onEngineStop={() => {
          if (fgRef.current) {
            fgRef.current.zoomToFit(600, 80);
            // Report settled positions back to parent for caching, but only once per graph update
            if (onPositionsSettled && !settledReportedRef.current) {
              settledReportedRef.current = true;
              const positions = new Map<string, { x: number; y: number }>();
              graphData.nodes.forEach((n: any) => {
                if (n.x !== undefined && n.y !== undefined) {
                  positions.set(n.id, { x: n.x, y: n.y });
                }
              });
              onPositionsSettled(positions);
            }
          }
        }}
      />
    </div>
  );
};
