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
  showSubGenres?: boolean;
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

export const Constellation: React.FC<ConstellationProps> = ({ nodes, centerNode, onNodeClick, activeNodeId, onPositionsSettled, showSubGenres }) => {
  const fgRef = useRef<any>();
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [hoverNode, setHoverNode] = useState<string | null>(null);
  const settledReportedRef = useRef<boolean>(false);

  // Reset reported flag when node structure changes (not simple reference changes)
  const nodeIdsStr = useMemo(() => nodes.map(n => n.id).sort().join(','), [nodes]);

  useEffect(() => {
    settledReportedRef.current = false;
  }, [nodeIdsStr]);

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

      // 별들을 화면 중앙 근처로 모으기 위해 scaleFactorX/Y 축소 (가깝게 배치하여 카메라 줌을 확대하도록 유도)
      const scaleFactorX = centerNode ? 0.35 : (showSubGenres ? 0.85 : 0.45);
      const scaleFactorY = centerNode ? 0.18 : (showSubGenres ? 0.45 : 0.35);
      let fx = (scaledDance - 0.5) * (dimensions.width * scaleFactorX);
      let fy = (0.5 - scaledEnergy) * (dimensions.height * scaleFactorY);

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
      
      // Explore 최상위 은하계 화면에서 대장르(주요 항성)들은 매번 동일한 배치 및 모양 유지를 위해 Pin 고정
      let shouldPin = !isExploring;
      if (isExploring && n.type === 'big_genre') {
        shouldPin = true;
      }

      // 세부 장르 상세 뷰(centerNode.type === 'sub_genre') 결정론적 고정 배치 정책 (도식 기반 부채꼴)
      if (centerNode && centerNode.type === 'sub_genre') {
        const hubId = centerNode.id;
        const activeX = -dimensions.width * 0.12;
        const activeY = dimensions.height * 0.04;

        if (n.type === 'big_genre') {
          // 장르는 왼쪽 상단 고정 (Y축 격차를 좁힘)
          fx = -dimensions.width * 0.12;
          fy = -dimensions.height * 0.12;
          shouldPin = true;
        } else if (n.id === hubId) {
          // 세부 장르(소장르)는 왼쪽 중하단 고정
          fx = activeX;
          fy = activeY;
          shouldPin = true;
        } else if (n.type === 'song' && n.id !== hubId) {
          // 수록곡들은 허브 노드를 중심으로 우측 부채꼴 모양으로 완전 고정 (거리를 360px -> 160px로 대폭 좁힘)
          const children = nodes.filter(node => node.type === 'song' && node.id !== hubId);
          const index = children.findIndex(node => node.id === n.id);
          if (index !== -1) {
            const angle = -Math.PI * 0.17 + (index / Math.max(1, children.length - 1)) * (Math.PI * 0.34);
            const distance = 160;
            fx = activeX + Math.cos(angle) * distance;
            fy = activeY + Math.sin(angle) * distance;
            shouldPin = true;
          }
        }
      }

      // 곡 상세 뷰(centerNode.type === 'song') 결정론적 고정 배치 정책 (도식 기반 부채꼴)
      if (centerNode && centerNode.type === 'song') {
        const activeX = -dimensions.width * 0.12;
        const activeY = dimensions.height * 0.04;

        if (n.type === 'big_genre') {
          // 장르(대장르)는 왼쪽 상단 고정
          fx = -dimensions.width * 0.12;
          fy = -dimensions.height * 0.12;
          shouldPin = true;
        } else if (n.type === 'sub_genre') {
          // 세부장르(하위 장르)는 왼쪽 중앙 고정 (허브 위치)
          fx = activeX;
          fy = activeY;
          shouldPin = true;
        } else if (n.type === 'song') {
          // 현재 곡 및 모든 수록곡 노드는 하위 장르 허브를 중심으로 우측 부채꼴 정렬 (물리 거리를 430px -> 200px로 대폭 좁힘)
          const children = nodes.filter(node => node.type === 'song');
          const index = children.findIndex(node => node.id === n.id);
          if (index !== -1) {
            const angle = -Math.PI * 0.17 + (index / Math.max(1, children.length - 1)) * (Math.PI * 0.34);
            const distance = 200;
            fx = activeX + Math.cos(angle) * distance;
            fy = activeY + Math.sin(angle) * distance;
            shouldPin = true;
          }
        }
      }

      // 대분류 장르 상세 뷰(centerNode.type === 'big_genre') 지향성 배치 정책
      if (centerNode && centerNode.type === 'big_genre') {
        if (n.type === 'big_genre') {
          // 대장르는 왼쪽 중앙부 고정 (거리를 가깝게 조정)
          fx = -dimensions.width * 0.14;
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
      if (shouldPin) {
        initialX = fx;
        initialY = fy;
      } else if (centerNode && centerNode.type === 'sub_genre' && n.type === 'song') {
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
      if (centerNode.type === 'song') {
        const bigGenreNode = fgNodes.find(n => n.type === 'big_genre');
        const subGenreNode = fgNodes.find(n => n.type === 'sub_genre');
        const songNodes = fgNodes.filter(n => n.type === 'song');

        if (bigGenreNode && subGenreNode) {
          // 대장르 -> 하위 장르 1대1 연결선
          fgLinks.push({ source: bigGenreNode.id, target: subGenreNode.id, isStructural: false });
          // 하위 장르 허브 -> 모든 곡 노드 부채꼴 연결선
          songNodes.forEach(sNode => {
            fgLinks.push({ source: subGenreNode.id, target: sNode.id, isStructural: false });
          });
        } else {
          // 폴백: 성게 모양 링크
          fgNodes.forEach(n => {
            if (n.id !== centerNode.id) {
              fgLinks.push({ source: centerNode.id, target: n.id, isStructural: false });
            }
          });
        }
      } else {
        fgNodes.forEach(n => {
          if (n.id !== centerNode.id) {
            fgLinks.push({ source: centerNode.id, target: n.id, isStructural: false });
          }
        });
      }
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

    // 대장르/세부장르 고정핀을 유지하면서 수록곡들이 옹기종기 미려하게 모이도록 상시 물리 엔진 셋팅
    const chargeStrength = centerNode ? -300 : (showSubGenres ? -1000 : -350);
    fg.d3Force('charge', forceManyBody().strength(chargeStrength));
    
    fg.d3Force('collide', forceCollide()
      .radius((node: any) => {
        const baseRadius = node.name ? node.name.length * (showSubGenres ? 4.5 : 3.5) : 8;
        const extraOffset = centerNode ? 22 : (showSubGenres ? 20 : 12);
        return baseRadius + extraOffset;
      })
      .iterations(3)
    );
    
    fg.d3Force('center', forceCenter(0, 0));

    // Pull unpinned nodes gently to their ideal audio-feature-based coordinates
    // X축은 넓게 흐르도록 strength를 0.08로 부드럽게 설정하고, Y축은 위아래 퍼짐 방지를 위해 strength를 0.18로 강력히 당깁니다.
    fg.d3Force('x', forceX((node: any) => node.fx_ideal || 0).strength(0.08));
    fg.d3Force('y', forceY((node: any) => node.fy_ideal || 0).strength(0.18));

    // Customize the link force to prevent constellation lines from collapsing nodes into tight clusters
    const linkForce = fg.d3Force('link');
    if (linkForce) {
      linkForce
        .distance((link: any) => {
          if (link.isStructural) return showSubGenres ? 250 : 150; // Structural constellation lines between big genres
          if (link.isOrbit) return showSubGenres ? 180 : 100;       // Orbit lines to sub-genres
          
          if (centerNode) {
            if (centerNode.type === 'big_genre') return 130; // 대장르 상세 뷰에서 옹기종기 모이도록 축소 (280 -> 130)
            if (centerNode.type === 'sub_genre') return 160; // 세부장르 상세 뷰 (360 -> 160)
            if (centerNode.type === 'song') return 200;      // 곡 상세 뷰 (430 -> 200)
          }
          return 100;
        })
        .strength(0.08); // Make it very gentle
    }
    
    // Canvas Boundary Clamping Force (상세 뷰에서는 좌우(X축)를 1.8배 광활하게 열어주되, 위아래(Y축)는 엄격하게 제어하여 축소 방지)
    const margin = 100;
    const boxForce = () => {
      const spaceMultiplierX = centerNode ? 1.8 : 1.0;
      const spaceMultiplierY = centerNode ? 1.1 : 1.0;
      const halfW = (dimensions.width * spaceMultiplierX) / 2 - margin;
      const halfH = (dimensions.height * spaceMultiplierY) / 2 - margin;
      graphData.nodes.forEach((node: any) => {
        node.x = Math.max(-halfW, Math.min(halfW, node.x));
        node.y = Math.max(-halfH, Math.min(halfH, node.y));
      });
    };
    fg.d3Force('box', boxForce);
    
    fg.d3ReheatSimulation();
  }, [graphData, dimensions, showSubGenres]);

  // Custom Canvas Rendering — stars with fade-in glow
  const drawNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const label = node.name || '';
    const isActive = node.id === activeNodeId;
    const isHovered = node.id === hoverNode;
    const isCenter = centerNode && node.id === centerNode.id;
    const isBig = node.type === 'big_genre' || isCenter || node.type === 'sub_genre';

    // Fade-in based on _birthTime
    let fadeAlpha = 1;
    if (node._birthTime) {
      const elapsed = Date.now() - node._birthTime;
      fadeAlpha = Math.min(elapsed / 1500, 1); // 1.5s fade-in
    }

    // Radius logic based on type and importance to establish visual hierarchy
    let baseOuterRadius = 3.5;
    let baseInnerRadius = 1.4;

    if (node.type === 'big_genre') {
      baseOuterRadius = 8;
      baseInnerRadius = 3.2;
    } else if (node.type === 'sub_genre') {
      baseOuterRadius = 5.5;
      baseInnerRadius = 2.2;
    } else if (node.type === 'song') {
      if (isCenter) {
        baseOuterRadius = 5;
        baseInnerRadius = 2;
      } else {
        baseOuterRadius = 3.5;
        baseInnerRadius = 1.4;
      }
    }

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
            if (centerNode) {
              // 상세 화면에서는 zoomToFit을 호출하면 노드들을 뷰포트 한가운데로 구겨넣으므로,
              // 우리가 고안한 수려한 오프셋 고정 레이아웃이 있는 그대로 왼쪽에 드러나도록 줌 레벨과 카메라 위치를 고정합니다. (옹기종기 모인 노드들에 맞춰 1.75로 대폭 확대)
              fgRef.current.centerAt(0, 0, 400);
              fgRef.current.zoom(1.75, 400);
            } else {
              // 루트 은하계 탐색 화면에서는 기존처럼 전체 노드가 한눈에 들어오도록 피팅합니다.
              fgRef.current.zoomToFit(400, 50);
            }

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
