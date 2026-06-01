import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { NodeData } from '../types';
import ForceGraph2D from 'react-force-graph-2d';
import { forceCollide, forceManyBody, forceCenter, forceX, forceY } from 'd3-force';
import { useDigging } from '../DiggingContext';

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
  const [zoomPercent, setZoomPercent] = useState(100);
  const [zoomInputStr, setZoomInputStr] = useState("100");
  const { hoveredNodeId, setHoveredNodeId } = useDigging();
  const settledReportedRef = useRef<boolean>(false);

  const handleZoomPercentUpdate = useCallback(({ k }: { k: number }) => {
    const percent = Math.round(k * 100);
    setZoomPercent(percent);
    setZoomInputStr(String(percent));
  }, []);

  const handleZoomIn = useCallback(() => {
    if (!fgRef.current) return;
    const currentScale = fgRef.current.zoom() || 1.0;
    const targetScale = Math.min(3.5, currentScale + 0.25);
    fgRef.current.zoom(targetScale, 300);
    const pct = Math.round(targetScale * 100);
    setZoomPercent(pct);
    setZoomInputStr(String(pct));
  }, []);

  const handleZoomOut = useCallback(() => {
    if (!fgRef.current) return;
    const currentScale = fgRef.current.zoom() || 1.0;
    const targetScale = Math.max(0.2, currentScale - 0.25);
    fgRef.current.zoom(targetScale, 300);
    const pct = Math.round(targetScale * 100);
    setZoomPercent(pct);
    setZoomInputStr(String(pct));
  }, []);

  const handleResetZoom = useCallback(() => {
    if (!fgRef.current) return;
    if (centerNode) {
      fgRef.current.centerAt(0, 0, 300);
      fgRef.current.zoom(1.25, 300);
      setZoomPercent(125);
      setZoomInputStr("125");
    } else {
      fgRef.current.zoomToFit(300, 50);
    }
  }, [centerNode]);

  const handleZoomInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setZoomInputStr(e.target.value);
  };

  const applyDirectZoom = useCallback((valueStr: string) => {
    if (!fgRef.current) return;
    let val = parseInt(valueStr, 10);
    if (isNaN(val)) {
      setZoomInputStr(String(zoomPercent));
      return;
    }
    
    // Clamp zoom percentage between 20% and 350%
    const minZoom = 20;
    const maxZoom = 350;
    if (val < minZoom) val = minZoom;
    if (val > maxZoom) val = maxZoom;
    
    const targetScale = val / 100;
    fgRef.current.zoom(targetScale, 300);
    setZoomPercent(val);
    setZoomInputStr(String(val));
  }, [zoomPercent]);

  const handleZoomInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      applyDirectZoom(zoomInputStr);
      e.currentTarget.blur();
    }
  };

  const handleZoomInputBlur = () => {
    applyDirectZoom(zoomInputStr);
  };

  // Custom 25% zoom wheel scroll step handler
  const handleWheelZoom = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    if (!fgRef.current) return;
    e.preventDefault();
    const currentScale = fgRef.current.zoom() || 1.0;
    
    let targetScale = currentScale;
    if (e.deltaY < 0) {
      targetScale = Math.min(3.5, currentScale + 0.25);
    } else {
      targetScale = Math.max(0.2, currentScale - 0.25);
    }
    
    fgRef.current.zoom(targetScale, 150);
    
    const targetPercent = Math.round(targetScale * 100);
    setZoomPercent(targetPercent);
    setZoomInputStr(String(targetPercent));
  }, []);

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
    // 1. Calculate projected coords for all nodes using Multidimensional Radial Projection (MDRP) of 6D audio features
    const projectedCoords = nodes.map(n => {
      const f = n.audioFeatures || (n as any).features || n.trackSnapshot?.features || (n.trackSnapshot as any)?.audio_features;
      let f6D;
      if (f) {
        f6D = {
          acousticness: f.acousticness ?? 0.5,
          danceability: f.danceability ?? 0.5,
          energy: f.energy ?? 0.5,
          instrumentalness: f.instrumentalness ?? 0.5,
          speechiness: f.speechiness ?? 0.5,
          valence: f.valence ?? 0.5
        };
      } else {
        // Fallback: Deterministic 6D audio profile based on ID hash
        let hash = 0;
        const str = n.id || n.name || 'default';
        for (let i = 0; i < str.length; i++) {
          hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        f6D = {
          acousticness: 0.2 + Math.abs((hash & 0xFF) / 255) * 0.6,
          danceability: 0.2 + Math.abs(((hash >> 4) & 0xFF) / 255) * 0.6,
          energy: 0.2 + Math.abs(((hash >> 8) & 0xFF) / 255) * 0.6,
          instrumentalness: 0.2 + Math.abs(((hash >> 12) & 0xFF) / 255) * 0.6,
          speechiness: 0.2 + Math.abs(((hash >> 16) & 0xFF) / 255) * 0.6,
          valence: 0.2 + Math.abs(((hash >> 20) & 0xFF) / 255) * 0.6
        };
      }

      // Map 6 dimensions to 2D using 6 axes separated by 60 degrees
      let px = 0;
      let py = 0;
      const keys: (keyof typeof f6D)[] = ['acousticness', 'danceability', 'energy', 'instrumentalness', 'speechiness', 'valence'];
      keys.forEach((key, idx) => {
        const angle = (idx * Math.PI) / 3; // 60 degrees
        const val = f6D[key];
        px += val * Math.cos(angle);
        py += val * Math.sin(angle);
      });

      return { id: n.id, px, py, features6D: f6D };
    });

    // 2. Perform min-max scaling to stretch coordinates to fill the viewport beautifully
    let minPx = Infinity, maxPx = -Infinity;
    let minPy = Infinity, maxPy = -Infinity;

    projectedCoords.forEach(pc => {
      if (pc.px < minPx) minPx = pc.px;
      if (pc.px > maxPx) maxPx = pc.px;
      if (pc.py < minPy) minPy = pc.py;
      if (pc.py > maxPy) maxPy = pc.py;
    });

    const rangePx = maxPx - minPx || 1;
    const rangePy = maxPy - minPy || 1;

    const scaledCoords = new Map<string, { sx: number; sy: number; features6D: any }>();
    projectedCoords.forEach(pc => {
      const sx = (pc.px - minPx) / rangePx; // [0, 1]
      const sy = (pc.py - minPy) / rangePy; // [0, 1]
      scaledCoords.set(pc.id, { sx, sy, features6D: pc.features6D });
    });

    // Deterministic coordinate lookup based on 6D projected features
    const getFixedCoords = (node: NodeData) => {
      const sc = scaledCoords.get(node.id) || { sx: 0.5, sy: 0.5 };

      // Map to 0.05 ~ 0.95 range for beautiful screen margins
      const scaledX = 0.05 + sc.sx * 0.90;
      const scaledY = 0.05 + sc.sy * 0.90;

      // 넓게 퍼지게 하기 위해 scaleFactorX/Y를 대폭 확대 (대장르 탐색 구간 극단적 마진 확보)
      const scaleFactorX = centerNode ? 0.65 : (showSubGenres ? 1.25 : 1.35);
      const scaleFactorY = centerNode ? 0.45 : (showSubGenres ? 0.85 : 1.15);
      let fx = (scaledX - 0.5) * (dimensions.width * scaleFactorX);
      let fy = (0.5 - scaledY) * (dimensions.height * scaleFactorY);

      // Deterministic Jitter based on ID hash to prevent direct overlapping
      let hash = 0;
      const str = node.id || node.name || '';
      for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
      }
      const jitterX = ((hash & 0xFF) / 255 - 0.5) * 20;
      const jitterY = (((hash >> 8) & 0xFF) / 255 - 0.5) * 20;

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
          // 수록곡들은 허브 노드를 중심으로 우측 부채꼴 모양으로 완전 고정 (거리 확장)
          const children = nodes.filter(node => node.type === 'song' && node.id !== hubId);
          const index = children.findIndex(node => node.id === n.id);
          if (index !== -1) {
            const angle = -Math.PI * 0.17 + (index / Math.max(1, children.length - 1)) * (Math.PI * 0.34);
            const distance = 260;
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
          // 현재 곡 및 모든 수록곡 노드는 하위 장르 허브를 중심으로 우측 부채꼴 정렬 (거리 확장)
          const children = nodes.filter(node => node.type === 'song');
          const index = children.findIndex(node => node.id === n.id);
          if (index !== -1) {
            const angle = -Math.PI * 0.17 + (index / Math.max(1, children.length - 1)) * (Math.PI * 0.34);
            const distance = 300;
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

    // --- 중첩 별자리 해결을 위한 결정론적 밀어내기 및 수동 예외 오프셋 이식 ---
    
    // 헬퍼 함수: 대소문자나 일부 키워드 포함 여부를 기준으로 대장르 노드를 안전하게 찾음
    const findBigGenreNode = (keywords: string[]) => {
      return fgNodes.find(n => {
        if (n.type !== 'big_genre' || !n.name) return false;
        const lowerName = n.name.toLowerCase();
        return keywords.every(kw => lowerName.includes(kw.toLowerCase()));
      });
    };

    // 1. 특정 중첩 대장르에 대한 강제 예외 오프셋
    // (A) Indie & Alternative - Punk & Hardcore
    const indieNode = findBigGenreNode(['indie']) || findBigGenreNode(['alternative']);
    const punkNode = findBigGenreNode(['punk']) || findBigGenreNode(['hardcore']);

    if (indieNode) {
      const dx = -155;
      const dy = -105;
      indieNode.x += dx;
      indieNode.y += dy;
      indieNode.fx_ideal += dx;
      indieNode.fy_ideal += dy;
      if (indieNode.fx !== undefined) indieNode.fx += dx;
      else indieNode.fx = indieNode.x;
      if (indieNode.fy !== undefined) indieNode.fy += dy;
      else indieNode.fy = indieNode.y;
    }

    if (punkNode) {
      const dx = 155;
      const dy = 105;
      punkNode.x += dx;
      punkNode.y += dy;
      punkNode.fx_ideal += dx;
      punkNode.fy_ideal += dy;
      if (punkNode.fx !== undefined) punkNode.fx += dx;
      else punkNode.fx = punkNode.x;
      if (punkNode.fy !== undefined) punkNode.fy += dy;
      else punkNode.fy = punkNode.y;
    }

    // (B) India & South Asia - Country & Americana - Pop
    const indiaNode = findBigGenreNode(['india']) || findBigGenreNode(['south asia']);
    const countryNode = findBigGenreNode(['country']) || findBigGenreNode(['americana']) || findBigGenreNode(['america']);
    const popNode = fgNodes.find(n => n.type === 'big_genre' && n.name.toLowerCase() === 'pop');

    if (indiaNode) {
      const dx = -165;
      const dy = -125;
      indiaNode.x += dx;
      indiaNode.y += dy;
      indiaNode.fx_ideal += dx;
      indiaNode.fy_ideal += dy;
      if (indiaNode.fx !== undefined) indiaNode.fx += dx;
      else indiaNode.fx = indiaNode.x;
      if (indiaNode.fy !== undefined) indiaNode.fy += dy;
      else indiaNode.fy = indiaNode.y;
    }

    if (countryNode) {
      const dx = 165;
      const dy = -125;
      countryNode.x += dx;
      countryNode.y += dy;
      countryNode.fx_ideal += dx;
      countryNode.fy_ideal += dy;
      if (countryNode.fx !== undefined) countryNode.fx += dx;
      else countryNode.fx = countryNode.x;
      if (countryNode.fy !== undefined) countryNode.fy += dy;
      else countryNode.fy = countryNode.y;
    }

    if (popNode) {
      const dx = 0;
      const dy = 185;
      popNode.x += dx;
      popNode.y += dy;
      popNode.fx_ideal += dx;
      popNode.fy_ideal += dy;
      if (popNode.fx !== undefined) popNode.fx += dx;
      else popNode.fx = popNode.x;
      if (popNode.fy !== undefined) popNode.fy += dy;
      else popNode.fy = popNode.y;
    }

    // (C) Electronic - Dance
    const electronicNode = findBigGenreNode(['electronic']);
    const danceNode = findBigGenreNode(['dance']);

    if (electronicNode) {
      const dx = -145;
      const dy = -85;
      electronicNode.x += dx;
      electronicNode.y += dy;
      electronicNode.fx_ideal += dx;
      electronicNode.fy_ideal += dy;
      if (electronicNode.fx !== undefined) electronicNode.fx += dx;
      else electronicNode.fx = electronicNode.x;
      if (electronicNode.fy !== undefined) electronicNode.fy += dy;
      else electronicNode.fy = electronicNode.y;
    }

    if (danceNode) {
      const dx = 145;
      const dy = 85;
      danceNode.x += dx;
      danceNode.y += dy;
      danceNode.fx_ideal += dx;
      danceNode.fy_ideal += dy;
      if (danceNode.fx !== undefined) danceNode.fx += dx;
      else danceNode.fx = danceNode.x;
      if (danceNode.fy !== undefined) danceNode.fy += dy;
      else danceNode.fy = danceNode.y;
    }

    // 2. 전역 결정론적 2D 노드 밀어내기 (Spring Repulsion Loop)
    // 모든 노래 및 장르에 대해 160px 거리 미만일 때 서로 밀어내도록 시뮬레이션
    const minDistance = 160;
    for (let iter = 0; iter < 12; iter++) {
      for (let i = 0; i < fgNodes.length; i++) {
        for (let j = i + 1; j < fgNodes.length; j++) {
          const nodeA = fgNodes[i];
          const nodeB = fgNodes[j];
          
          if (nodeA.id === 'spaceship' || nodeA.id === 'ship' || nodeB.id === 'spaceship' || nodeB.id === 'ship') continue;
          
          const dx = nodeB.x - nodeA.x;
          const dy = nodeB.y - nodeA.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < minDistance) {
            const overlap = minDistance - dist;
            let pushX = 0;
            let pushY = 0;
            if (dist === 0) {
              const angle = (((nodeA.id.charCodeAt(0) || 0) * 17) % 360) * Math.PI / 180;
              pushX = Math.cos(angle) * minDistance / 2;
              pushY = Math.sin(angle) * minDistance / 2;
            } else {
              pushX = (dx / dist) * overlap * 0.55;
              pushY = (dy / dist) * overlap * 0.55;
            }
            
            const isAPinned = centerNode && nodeA.id === centerNode.id;
            const isBPinned = centerNode && nodeB.id === centerNode.id;
            
            if (isAPinned && !isBPinned) {
              nodeB.x += pushX * 2;
              nodeB.y += pushY * 2;
              nodeB.fx_ideal += pushX * 2;
              nodeB.fy_ideal += pushY * 2;
              if (nodeB.fx !== undefined) { nodeB.fx += pushX * 2; }
              if (nodeB.fy !== undefined) { nodeB.fy += pushY * 2; }
            } else if (!isAPinned && isBPinned) {
              nodeA.x -= pushX * 2;
              nodeA.y -= pushY * 2;
              nodeA.fx_ideal -= pushX * 2;
              nodeA.fy_ideal -= pushY * 2;
              if (nodeA.fx !== undefined) { nodeA.fx -= pushX * 2; }
              if (nodeA.fy !== undefined) { nodeA.fy -= pushY * 2; }
            } else {
              nodeA.x -= pushX;
              nodeA.y -= pushY;
              nodeA.fx_ideal -= pushX;
              nodeA.fy_ideal -= pushY;
              if (nodeA.fx !== undefined) { nodeA.fx -= pushX; }
              if (nodeA.fy !== undefined) { nodeA.fy -= pushY; }

              nodeB.x += pushX;
              nodeB.y += pushY;
              nodeB.fx_ideal += pushX;
              nodeB.fy_ideal += pushY;
              if (nodeB.fx !== undefined) { nodeB.fx += pushX; }
              if (nodeB.fy !== undefined) { nodeB.fy += pushY; }
            }
          }
        }
      }
    }

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

    // --- 오디오 특성 유사도 은하선 (Similarity Links) 생성 ---
    // 만약 대장르에 속한 노래 또는 세부 장르라면, 오디오 특성끼리 유사한 별끼리 모이도록 설계
    const connectableNodes = fgNodes.filter(n => {
      if (n.id === 'spaceship' || n.id === 'ship' || n.type === 'big_genre') return false;
      return true;
    });

    // 6차원 공간상의 Euclidean 거리 계산 도우미
    const get6Distance = (nodeA: any, nodeB: any) => {
      const scA = scaledCoords.get(nodeA.id);
      const scB = scaledCoords.get(nodeB.id);
      if (!scA || !scB) return Infinity;

      let sumSq = 0;
      const keys = ['acousticness', 'danceability', 'energy', 'instrumentalness', 'speechiness', 'valence'];
      keys.forEach(key => {
        const valA = scA.features6D[key] ?? 0.5;
        const valB = scB.features6D[key] ?? 0.5;
        sumSq += Math.pow(valA - valB, 2);
      });
      return Math.sqrt(sumSq);
    };

    // 각 노드마다 가장 6D 성격이 가까운 이웃 2개를 선별해 연결선으로 편입
    connectableNodes.forEach(nodeA => {
      const distances = connectableNodes
        .filter(nodeB => nodeB.id !== nodeA.id)
        .map(nodeB => ({ node: nodeB, dist: get6Distance(nodeA, nodeB) }))
        .sort((a, b) => a.dist - b.dist);

      const maxNeighbors = Math.min(2, distances.length);
      for (let i = 0; i < maxNeighbors; i++) {
        const neighbor = distances[i];
        if (neighbor.dist < 0.65) {
          const exists = fgLinks.some(l => 
            (l.source === nodeA.id && l.target === neighbor.node.id) ||
            (l.source === neighbor.node.id && l.target === nodeA.id)
          );
          if (!exists) {
            fgLinks.push({
              source: nodeA.id,
              target: neighbor.node.id,
              isStructural: false,
              isSimilarity: true,
              distance: neighbor.dist
            });
          }
        }
      }
    });

    return { nodes: fgNodes, links: fgLinks };
  }, [nodes, centerNode]);

  // Handle D3 Force updates dynamically based on mode (Active physical forces vs absolute coordinate pinning)
  useEffect(() => {
    if (!fgRef.current) return;
    const fg = fgRef.current;

    // 대장르/세부장르 고정핀을 유지하면서 수록곡들이 옹기종기 미려하게 모이도록 상시 물리 엔진 셋팅 (척력 극대화 및 극단적 거리 확장)
    const chargeStrength = centerNode ? -2000 : -5000;
    fg.d3Force('charge', forceManyBody().strength(chargeStrength));
    
    fg.d3Force('collide', forceCollide()
      .radius((node: any) => {
        const baseRadius = node.name ? node.name.length * (showSubGenres ? 8.5 : 7.5) : 25;
        const extraOffset = centerNode ? 80 : (showSubGenres ? 70 : 50);
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
          if (link.isStructural) return showSubGenres ? 1000 : 850; // Structural constellation lines between big genres
          if (link.isOrbit) return showSubGenres ? 550 : 400;       // Orbit lines to sub-genres
          if (link.isSimilarity) return 450;                        // Similarity links pull similar songs together
          
          if (centerNode) {
            if (centerNode.type === 'big_genre') return 450; // 대장르 상세 뷰
            if (centerNode.type === 'sub_genre') return 550; // 세부장르 상세 뷰
            if (centerNode.type === 'song') return 600;      // 곡 상세 뷰
          }
          return 400;
        })
        .strength((link: any) => {
          if (link.isSimilarity) return 0.05; // Gentle similarity pull force
          return 0.08;
        });
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
    const isHovered = node.id === hoveredNodeId;
    const isCenter = centerNode && node.id === centerNode.id;
    const isBig = node.type === 'big_genre' || isCenter || node.type === 'sub_genre';

    // Fade-in based on _birthTime
    let fadeAlpha = 1;
    if (node._birthTime) {
      const elapsed = Date.now() - node._birthTime;
      fadeAlpha = Math.min(elapsed / 1500, 1); // 1.5s fade-in
    }

    // Radius logic based on type and importance to establish visual hierarchy (별 크기 추가 대폭 증가)
    let baseOuterRadius = 8.5;
    let baseInnerRadius = 3.4;

    if (node.type === 'big_genre') {
      baseOuterRadius = 19.5;
      baseInnerRadius = 7.8;
    } else if (node.type === 'sub_genre') {
      baseOuterRadius = 13.5;
      baseInnerRadius = 5.4;
    } else if (node.type === 'song') {
      if (isCenter) {
        baseOuterRadius = 12.0;
        baseInnerRadius = 4.8;
      } else {
        baseOuterRadius = 8.5;
        baseInnerRadius = 3.4;
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

    // Draw text label with background box for readability (폰트 크기 추가 증가)
    const baseFontSize = isCenter ? 24 : (node.type === 'big_genre' ? 20 : (node.type === 'sub_genre' ? 17 : 14)); 
    const minReadableScreenSize = 4; // minimum pixels on screen to draw text
    
    // Label Visibility Control
    const showLabel = (baseFontSize * globalScale >= minReadableScreenSize) || isActive || isHovered || isBig;

    if (showLabel) {
      ctx.font = `${isActive ? '700' : '500'} ${baseFontSize}px "Outfit", "Inter", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      const textY = node.y + outerRadius + 10;
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
  }, [activeNodeId, centerNode, hoveredNodeId]);

  // Link color with fade-in sync
  const getLinkColor = useCallback((link: any) => {
    const sourceAlpha = link.source?._birthTime
      ? Math.min((Date.now() - link.source._birthTime) / 1500, 1) : 1;
    const targetAlpha = link.target?._birthTime
      ? Math.min((Date.now() - link.target._birthTime) / 1500, 1) : 1;
    const baseAlpha = Math.min(sourceAlpha, targetAlpha);

    if (link.isStructural) return `rgba(14, 165, 233, ${0.2 * baseAlpha})`;

    const isHighlight = hoveredNodeId && (link.source.id === hoveredNodeId || link.target.id === hoveredNodeId);
    return isHighlight
      ? `rgba(0, 255, 255, ${0.7 * baseAlpha})`
      : `rgba(255, 255, 255, ${0.12 * baseAlpha})`;
  }, [hoveredNodeId]);

  return (
    <div ref={containerRef} className="absolute inset-0 w-full h-full z-10 cursor-move" onWheel={handleWheelZoom}>
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
          const isHighlight = hoveredNodeId && (link.source.id === hoveredNodeId || link.target.id === hoveredNodeId);
          if (link.isSimilarity) return isHighlight ? 1.2 : 0.4;
          return isHighlight ? 1.5 : 0.5;
        }}
        linkDashArray={(link: any) => link.isSimilarity ? [2, 2] : null}
        onNodeClick={(node) => onNodeClick(node as NodeData)}
        onNodeHover={(node) => setHoveredNodeId(node ? (node as NodeData).id : null)}
        onZoom={handleZoomPercentUpdate}
        enableNodeDrag={false}
        enableZoomInteraction={false}
        enablePanInteraction={true}
        minZoom={0.2}
        maxZoom={3.5}
        d3VelocityDecay={0.4} // Smooth drifting
        warmupTicks={150} // 150 Warmup Ticks로 로딩 즉시 성도 배치 사전 계산 완료
        cooldownTicks={1} // Cooldown Ticks를 1로 제한하여 화면 렌더링 즉시 정적 레이아웃으로 고정 (Tick 정지)
        onEngineStop={() => {
          if (fgRef.current) {
            if (centerNode) {
              // 상세 화면에서는 zoomToFit을 호출하면 노드들을 뷰포트 한가운데로 구겨넣으므로,
              // 우리가 고안한 수려한 오프셋 고정 레이아웃이 있는 그대로 왼쪽에 드러나도록 줌 레벨과 카메라 위치를 고정합니다. (옹기종기 모인 노드들에 맞춰 1.25로 확대 조정)
              fgRef.current.centerAt(0, 0, 400);
              fgRef.current.zoom(1.25, 400);
              setZoomPercent(125);
            } else {
              // 루트 은하계 탐색 화면에서는 기존처럼 전체 노드가 한눈에 들어오도록 피팅합니다.
              fgRef.current.zoomToFit(400, 50);
              // zoomToFit 이후 실제 줌 레벨을 동기화
              setTimeout(() => {
                if (fgRef.current) {
                  setZoomPercent(Math.round(fgRef.current.zoom() * 100));
                }
              }, 450);
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

      {/* Futuristic Glassmorphic Zoom Controller */}
      <div className="absolute bottom-6 right-6 z-30 flex items-center gap-2.5 px-3 py-2 rounded-xl border border-[#00FFFF]/30 bg-black/75 backdrop-blur-md shadow-[0_0_15px_rgba(0,255,255,0.15)] text-white text-xs select-none">
        <button 
          onClick={handleResetZoom} 
          className="flex items-center justify-center p-1.5 rounded hover:bg-white/10 text-[#00FFFF] active:scale-95 transition-all cursor-pointer"
          title="Reset Zoom"
        >
          {/* Magnifying Glass (Search) Icon */}
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        </button>
        <div className="w-[1.5px] h-3.5 bg-white/15" />
        <button 
          onClick={handleZoomOut} 
          className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 text-white/80 hover:text-white font-mono font-bold active:scale-90 transition-all cursor-pointer"
          title="Zoom Out"
        >
          -
        </button>
        <div className="flex items-center">
          <input 
            type="number"
            value={zoomInputStr}
            onChange={handleZoomInputChange}
            onKeyDown={handleZoomInputKeyDown}
            onBlur={handleZoomInputBlur}
            className="w-10 text-center font-mono text-[#00FFFF] font-bold bg-transparent border-b border-[#00FFFF]/30 focus:border-[#00FFFF] focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none cursor-text"
            min={20}
            max={350}
          />
          <span className="font-mono text-[#00FFFF] font-bold select-none ml-0.5">%</span>
        </div>
        <button 
          onClick={handleZoomIn} 
          className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 text-white/80 hover:text-white font-mono font-bold active:scale-90 transition-all cursor-pointer"
          title="Zoom In"
        >
          +
        </button>
      </div>
    </div>
  );
};
