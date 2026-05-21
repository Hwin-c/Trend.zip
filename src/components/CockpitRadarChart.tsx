import React from 'react';
import { AudioFeatures } from '../types';

interface CockpitRadarChartProps {
  width: number;
  height: number;
  features: AudioFeatures;
  compareFeatures?: AudioFeatures;
}

export const CockpitRadarChart: React.FC<CockpitRadarChartProps> = ({
  width,
  height,
  features,
  compareFeatures,
}) => {
  const cx = width / 2;
  const cy = height / 2;
  const maxRadius = Math.min(width, height) * 0.35; // 차트가 가득 차면서 패딩을 주도록 함

  const variables = [
    { label: 'Acoustic', key: 'acousticness' as keyof AudioFeatures },
    { label: 'Dance', key: 'danceability' as keyof AudioFeatures },
    { label: 'Energy', key: 'energy' as keyof AudioFeatures },
    { label: 'Instrument', key: 'instrumentalness' as keyof AudioFeatures },
    { label: 'Speech', key: 'speechiness' as keyof AudioFeatures },
    { label: 'Valence', key: 'valence' as keyof AudioFeatures },
  ];

  // 6개 축의 좌표 계산 (12시 방향을 시작점으로 시계방향 회전)
  const getCoordinates = (index: number, value: number, radius: number) => {
    // index 0이 12시 방향(즉 -90도)이 되도록 함
    const angle = (index * Math.PI) / 3 - Math.PI / 2;
    const r = value * radius;
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    };
  };

  // 그리드 다각형 그리기 (예: 25%, 50%, 75%, 100%)
  const renderGridPolygons = () => {
    const levels = [0.25, 0.5, 0.75, 1.0];
    return levels.map((level, levelIdx) => {
      const points = variables.map((_, i) => {
        const { x, y } = getCoordinates(i, level, maxRadius);
        return `${x},${y}`;
      }).join(' ');

      return (
        <polygon
          key={levelIdx}
          points={points}
          fill="none"
          stroke="rgba(255, 255, 255, 0.08)"
          strokeWidth="0.8"
        />
      );
    });
  };

  // 중심에서 각 꼭짓점으로 뻗어 나가는 축 선 그리기
  const renderAxisLines = () => {
    return variables.map((_, i) => {
      const { x, y } = getCoordinates(i, 1.0, maxRadius);
      return (
        <line
          key={i}
          x1={cx}
          y1={cy}
          x2={x}
          y2={y}
          stroke="rgba(255, 255, 255, 0.12)"
          strokeWidth="0.8"
        />
      );
    });
  };

  // 각 축 라벨 렌더링
  const renderLabels = () => {
    return variables.map((v, i) => {
      // 라벨은 100% 반지름보다 약간 더 멀리 배치
      const { x, y } = getCoordinates(i, 1.15, maxRadius);
      const angle = (i * Math.PI) / 3 - Math.PI / 2;
      
      // 텍스트 수평 정렬 결정
      let textAnchor = 'middle';
      const cos = Math.cos(angle);
      if (cos > 0.1) textAnchor = 'start';
      else if (cos < -0.1) textAnchor = 'end';

      // 텍스트 수직 보정
      let dy = '0.35em';
      const sin = Math.sin(angle);
      if (sin < -0.9) dy = '-0.2em'; // 맨 위 라벨
      else if (sin > 0.9) dy = '0.9em'; // 맨 아래 라벨

      return (
        <text
          key={i}
          x={x}
          y={y}
          textAnchor={textAnchor}
          dy={dy}
          className="fill-white/60 text-[10px] font-mono select-none"
        >
          {v.label}
        </text>
      );
    });
  };

  // 데이터 폴리곤 계산 (A: 장르 평균)
  const getPointsString = (featuresData: AudioFeatures) => {
    return variables.map((v, i) => {
      const value = featuresData[v.key] ?? 0;
      const { x, y } = getCoordinates(i, value, maxRadius);
      return `${x},${y}`;
    }).join(' ');
  };

  const pointsA = getPointsString(features);
  const pointsB = compareFeatures ? getPointsString(compareFeatures) : '';

  return (
    <svg width={width} height={height} className="overflow-visible select-none">
      {/* 1. 배경 그리드 다각형 */}
      {renderGridPolygons()}

      {/* 2. 축 웹 선 */}
      {renderAxisLines()}

      {/* 3. 축 라벨 텍스트 */}
      {renderLabels()}

      {/* 4. 데이터 영역 A (장르 평균 - 보라색) */}
      <polygon
        points={pointsA}
        fill="rgba(139, 92, 246, 0.25)"
        stroke="#8B5CF6"
        strokeWidth="1.5"
        className="transition-all duration-500 ease-out"
        style={{ filter: 'drop-shadow(0 0 4px rgba(139, 92, 246, 0.4))' }}
      />

      {/* 5. 데이터 영역 B (선택 곡 - 네온 그린/민트) */}
      {compareFeatures && (
        <polygon
          points={pointsB}
          fill="rgba(16, 185, 129, 0.3)"
          stroke="#10B981"
          strokeWidth="1.5"
          className="transition-all duration-500 ease-out"
          style={{ filter: 'drop-shadow(0 0 6px rgba(16, 185, 129, 0.5))' }}
        />
      )}

      {/* 6. 중심 코어 데코레이션 */}
      <circle cx={cx} cy={cy} r="2" fill="#00FFFF" className="animate-pulse" />
    </svg>
  );
};
