import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { NodeData } from '../types';
import ForceGraph2D from 'react-force-graph-2d';
import { forceCollide, forceManyBody, forceCenter, forceX, forceY } from 'd3-force';

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
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [hoverNode, setHoverNode] = useState<string | null>(null);
  const settledReportedRef = useRef<boolean>(false);

  // Reset reported flag when nodes change
  useEffect(() => {
    settledReportedRef.current = false;
  }, [nodes]);

  // Handle Container Resize responsively using ResizeObserver and Window Resize Event
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        setDimensions({
          width: clientWidth || 800,
          height: clientHeight || 600
        });
      }
    };

    window.addEventListener('resize', handleResize);

    if (containerRef.current) {
      const resizeObserver = new ResizeObserver((entries) => {
        for (let entry of entries) {
          const { width, height } = entry.contentRect;
          setDimensions({ 
            width: width || 800, 
            height: height || 600 
          });
        }
      });
      resizeObserver.observe(containerRef.current);
      return () => {
        window.removeEventListener('resize', handleResize);
        resizeObserver.disconnect();
      };
    }

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Generate Data for ForceGraph
  const graphData = useMemo(() => {
    // Gather features of all nodes to perform dynamic Min-Max Scaling (normalizes and spreads nodes across the entire viewport)
    const rawFeatures = nodes.map(n => {
      let danceability = 0.5;
      let energy = 0.5;

      const features = n.audioFeatures || (n as any).features || n.trackSnapshot?.features || (n.trackSnapshot as any)?.audio_features;
      if (features) {
        danceability = features.danceability ?? 0.5;
        energy = features.energy ?? 0.5;
      } else if ((n as any).danceability !== undefined && (n as any).energy !== undefined) {
        danceability = (n as any).danceability;
        energy = (n as any).energy;
      } else {
        // Fallback: Deterministic position based on ID hash
        let hash = 0;
        const str = n.id || n.name || '';
        for (let i = 0; i < str.length; i++) {
          hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        danceability = 0.3 + Math.abs((hash & 0xFF) / 255) * 0.4;
        energy = 0.3 + Math.abs(((hash >> 8) & 0xFF) / 255) * 0.4;
      }

      return { id: n.id, danceability, energy };
    });

    const sortedByDance = [...rawFeatures].sort((a, b) => a.danceability - b.danceability);
    const sortedByEnergy = [...rawFeatures].sort((a, b) => a.energy - b.energy);

    const danceRanks = new Map<string, number>();
    const energyRanks = new Map<string, number>();
    const totalNodes = rawFeatures.length;

    sortedByDance.forEach((rf, idx) => {
      const ratio = totalNodes > 1 ? idx / (totalNodes - 1) : 0.5;
      danceRanks.set(rf.id, ratio);
    });

    sortedByEnergy.forEach((rf, idx) => {
      const ratio = totalNodes > 1 ? idx / (totalNodes - 1) : 0.5;
      energyRanks.set(rf.id, ratio);
    });

    // Deterministic coordinate lookup based on rank of audio features
    const getFixedCoords = (node: NodeData) => {
      const rawDanceRatio = danceRanks.get(node.id) ?? 0.5;
      const rawEnergyRatio = energyRanks.get(node.id) ?? 0.5;

      // Map to 0.08 ~ 0.92 range for nice screen margins
      const scaledDance = 0.08 + rawDanceRatio * 0.84;
      const scaledEnergy = 0.08 + rawEnergyRatio * 0.84;

      // X: Danceability rank ratio (0 ~ 1) => (scaledDance - 0.5) * (dimensions.width * 0.85)
      // Y: Energy rank ratio (0 ~ 1) => (0.5 - scaledEnergy) * (dimensions.height * 0.8)
      let fx = (scaledDance - 0.5) * (dimensions.width * 0.85);
      let fy = (0.5 - scaledEnergy) * (dimensions.height * 0.8);

      // Deterministic Jitter based on ID hash to prevent direct overlapping
      let hash = 0;
      const str = node.id || node.name || '';
      for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
      }
      const jitterX = ((hash & 0xFF) / 255 - 0.5) * 15;
      const jitterY = (((hash >> 8) & 0xFF) / 255 - 0.5) * 15;

      // Special centerNode overriding (spaceship fallback id check)
      if (node.id === 'spaceship' || node.id === 'ship') {
        fx = 0;
        fy = 0;
      }

      return { fx: fx + jitterX, fy: fy + jitterY };
    };

    const fgNodes = nodes.map(n => {
      const coords = getFixedCoords(n);
      const isExploring = !centerNode;
      
      let fx = coords.fx;
      let fy = coords.fy;
      
      // In explore view, do not pin big genres directly so forceCollide can push them apart and prevent overlap!
      let shouldPin = !isExploring;

      // 세부 장르 상세 뷰(centerNode.type === 'sub_genre') 지향성 배치 정책
      if (centerNode && centerNode.type === 'sub_genre') {
        if (n.type === 'big_genre') {
          // 대장르는 왼쪽 상단 고정
          fx = -dimensions.width / 4;
          fy = -dimensions.height / 4;
          shouldPin = true;
        } else if (n.type === 'sub_genre') {
          // 세부 장르는 왼쪽 중반 고정
          fx = -dimensions.width / 4;
          fy = 0;
          shouldPin = true;
        } else if (n.type === 'song') {
          // 노래들은 중앙 및 우측에 자유 유영하도록 고정 해제
          fx = undefined as any;
          fy = undefined as any;
          shouldPin = false;
        }
      }

      // 대분류 장르 상세 뷰(centerNode.type === 'big_genre') 지향성 배치 정책
      if (centerNode && centerNode.type === 'big_genre') {
        if (n.type === 'big_genre') {
          // 대장르는 왼쪽 중앙 끝 고정
          fx = -dimensions.width / 3;
          fy = 0;
          shouldPin = true;
        } else if (n.type === 'sub_genre') {
          // 세부 장르들은 중앙 및 우측에 자유 유영하도록 고정 해제
          fx = undefined as any;
          fy = undefined as any;
          shouldPin = false;
        }
      }

      // 초기 유영 시작 지점을 중앙 및 우측 영역으로 유도
      let initialX = coords.fx;
      let initialY = coords.fy;
      if (centerNode && centerNode.type === 'sub_genre' && n.type === 'song') {
        initialX = dimensions.width / 8 + (Math.random() - 0.2) * (dimensions.width / 3);
        initialY = (Math.random() - 0.5) * (dimensions.height / 2);
      } else if (centerNode && centerNode.type === 'big_genre' && n.type === 'sub_genre') {
        initialX = dimensions.width / 8 + (Math.random() - 0.2) * (dimensions.width / 3);
        initialY = (Math.random() - 0.5) * (dimensions.height / 2);
      }

      return {
        ...n,
        x: initialX,
        y: initialY,
        fx: shouldPin ? fx : undefined,
        fy: shouldPin ? fy : undefined,
        fx_ideal: coords.fx, // Store the ideal coordinates
        fy_ideal: coords.fy,
        _birthTime: (n as any)._birthTime,
        val: n.type === 'big_genre' ? 2 : 1
      };
    });
    const fgLinks: any[] = [];

    if (centerNode) {
      fgNodes.forEach(n => {
        if (n.id !== centerNode.id) {
          fgLinks.push({ source: centerNode.id, target: n.id, isStructural: false });
        }
      });
    } else {
      // Root Explore View constellation layout mapping
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

  // Handle D3 Force updates dynamically based on mode (Active physical forces vs absolute coordinate pinning)
  useEffect(() => {
    if (!fgRef.current) return;
    const fg = fgRef.current;

    // 대장르/세부장르 고정핀을 유지하면서 수록곡들이 겹침 없이 수려하게 유영하도록 상시 물리 엔진 셋팅
    fg.d3Force('charge', forceManyBody().strength(-900));
    
    fg.d3Force('collide', forceCollide()
      .radius((node: any) => (node.name ? node.name.length * 6 : 10) + 25)
      .iterations(3)
    );
    
    fg.d3Force('center', forceCenter(0, 0));

    // Pull unpinned nodes gently to their ideal audio-feature-based coordinates
    fg.d3Force('x', forceX((node: any) => node.fx_ideal || 0).strength(0.08));
    fg.d3Force('y', forceY((node: any) => node.fy_ideal || 0).strength(0.08));

    // Customize the link force to prevent constellation lines from collapsing nodes into tight clusters
    const linkForce = fg.d3Force('link');
    if (linkForce) {
      linkForce
        .distance((link: any) => {
          if (link.isStructural) return 200; // Structural constellation lines between big genres
          if (link.isOrbit) return 120;      // Orbit lines to sub-genres
          return 100;
        })
        .strength(0.08); // Make it very gentle
    }
    
    // Canvas Boundary Clamping Force
    const margin = 50;
    const boxForce = () => {
      const halfW = dimensions.width / 2 - margin;
      const halfH = dimensions.height / 2 - margin;
      graphData.nodes.forEach((node: any) => {
        node.x = Math.max(-halfW, Math.min(halfW, node.x));
        node.y = Math.max(-halfH, Math.min(halfH, node.y));
      });
    };
    fg.d3Force('box', boxForce);
    
    fg.d3ReheatSimulation();
  }, [graphData, dimensions]);

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
    const baseOuterRadius = isBig ? 6 : 3.5;
    const baseInnerRadius = isBig ? 2.5 : 1.4;

    // Twinkling effect — slow and subtle
    const time = Date.now();
    const twinkleOffset = (node.id?.charCodeAt(0) || 0) * 100;
    const twinkle = Math.sin((time + twinkleOffset) / 1200) * 0.15 + 0.85;
    const multiplier = isActive || isHovered ? 1.5 : twinkle;

    const outerRadius = baseOuterRadius * multiplier;
    const innerRadius = baseInnerRadius * multiplier;

    // Color variation by type - Vivid Cyber Colors
    let coreColor = '#FFFFFF';
    let flareColor = 'rgba(255, 255, 255, ';
    if (node.type === 'big_genre') {
      coreColor = '#E0F2FE';
      flareColor = 'rgba(14, 165, 233, '; // Electric Cyan Glow
    } else if (node.type === 'song') {
      coreColor = '#00FFFF'; // Bright Cyan Core
      flareColor = 'rgba(0, 255, 255, ';
    } else if (node.type === 'sub_genre') {
      coreColor = '#F472B6'; // Pink Nebula Star
      flareColor = 'rgba(244, 114, 182, ';
    }

    ctx.save();
    ctx.globalAlpha = fadeAlpha;

    // Draw glowing soft halo
    const glowRadius = outerRadius * (isBig ? 4.5 : 3.5);
    const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, glowRadius);
    gradient.addColorStop(0, flareColor + (isActive || isHovered ? '0.7)' : (isBig ? '0.35)' : '0.2)')));
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
    const baseFontSize = isCenter ? 15 : (node.type === 'big_genre' ? 12 : (node.type === 'sub_genre' ? 10 : 9)); 
    const minReadableScreenSize = 4; // minimum pixels on screen to draw text
    
    // Label Visibility Control
    const showLabel = (baseFontSize * globalScale >= minReadableScreenSize) || isActive || isHovered || isBig;

    if (showLabel) {
      ctx.font = `${isActive ? '700' : '500'} ${baseFontSize}px "Outfit", "Inter", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      const textY = node.y + outerRadius + 8;
      const textWidth = ctx.measureText(label).width;
      const padX = 6;
      const padY = 4;

      // Semi-transparent background box behind text - Sleek Futuristic Border Box
      ctx.fillStyle = `rgba(5, 5, 10, ${0.75 * fadeAlpha})`;
      ctx.strokeStyle = isActive || isHovered ? 'rgba(0, 255, 255, 0.4)' : 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      
      const rx = node.x - textWidth / 2 - padX;
      const ry = textY - padY / 2;
      const rw = textWidth + padX * 2;
      const rh = baseFontSize + padY;

      // Draw Rounded Rect for Text Badge
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(rx, ry, rw, rh, 4);
      } else {
        ctx.rect(rx, ry, rw, rh);
      }
      ctx.fill();
      ctx.stroke();

      // Text Shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
      ctx.shadowBlur = 3;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;

      // Label Fill Color - Vividly bright neon texts
      if (isActive || isHovered) {
        ctx.fillStyle = '#00FFFF';
      } else if (node.type === 'big_genre') {
        ctx.fillStyle = '#F8FAFC'; // Soft White
      } else if (node.type === 'sub_genre') {
        ctx.fillStyle = '#FDA4AF'; // Light Soft Pink
      } else {
        ctx.fillStyle = '#CBD5E1'; // Soft Gray
      }

      ctx.fillText(label, node.x, textY);
    }

    ctx.restore();
  }, [activeNodeId, centerNode, hoverNode]);

  // Link color with fade-in sync
  const getLinkColor = useCallback((link: any) => {
    const sourceAlpha = link.source?._birthTime
      ? Math.min((Date.now() - link.source._birthTime) / 1500, 1) : 1;
    const targetAlpha = link.target?._birthTime
      ? Math.min((Date.now() - link.target._birthTime) / 1500, 1) : 1;
    const baseAlpha = Math.min(sourceAlpha, targetAlpha);

    if (link.isStructural) return `rgba(14, 165, 233, ${0.2 * baseAlpha})`;

    const isHighlight = hoverNode && (link.source.id === hoverNode || link.target.id === hoverNode);
    return isHighlight
      ? `rgba(0, 255, 255, ${0.7 * baseAlpha})`
      : `rgba(255, 255, 255, ${0.12 * baseAlpha})`;
  }, [hoverNode]);

  return (
    <div ref={containerRef} className="absolute inset-0 w-full h-full z-10 cursor-move">
      <ForceGraph2D
        ref={fgRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={graphData}
        nodeLabel={() => ''}
        nodeCanvasObject={drawNode}
        linkColor={getLinkColor}
        linkWidth={(link: any) => {
          if (link.isStructural) return 0.75;
          return hoverNode && (link.source.id === hoverNode || link.target.id === hoverNode) ? 1.5 : 0.5;
        }}
        onNodeClick={(node) => onNodeClick(node as NodeData)}
        onNodeHover={(node) => setHoverNode(node ? (node as NodeData).id : null)}
        enableNodeDrag={true}
        enableZoomInteraction={true}
        enablePanInteraction={true}
        minZoom={0.2}
        maxZoom={3.5}
        d3VelocityDecay={0.4} // Smooth drifting
        warmupTicks={0}
        cooldownTicks={0}
        onEngineStop={() => {
          if (fgRef.current) {
            fgRef.current.zoomToFit(400, 50);
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
