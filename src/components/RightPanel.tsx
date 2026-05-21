import React, { useMemo } from 'react';
import { AudioFeatures } from '../types';
import { GlassPanel } from './GlassPanel';
import { CustomResponsiveContainer } from './CustomResponsiveContainer';
import { CockpitRadarChart } from './CockpitRadarChart';

interface RightPanelProps {
  title: string;
  subtitle: string;
  features: AudioFeatures;
  compareFeatures?: AudioFeatures;
}

export const RightPanel: React.FC<RightPanelProps> = ({ title, subtitle, features, compareFeatures }) => {
  if (!features) return null;

  const formatPercent = (val?: number) => val ? `${Math.round(val * 100)}%` : '0%';

  return (
    <GlassPanel 
      className="w-full h-full text-white z-20 shadow-2xl flex flex-col justify-between"
    >
      <div className="flex-1 min-h-0 w-full p-4 flex flex-col justify-between">
        <h2 className="text-xl font-medium mb-1">{title}</h2>
      <div className="text-sm text-white/50 mb-4 flex items-center gap-2">
        <div className="w-4 h-4 bg-[#8B5CF6]/50 border border-[#8B5CF6] rounded-sm" />
        {subtitle}
      </div>

      <div className="w-full flex-1 min-h-0 mb-4 relative flex items-center justify-center">
        <CustomResponsiveContainer>
          {(width, height) => (
            <CockpitRadarChart 
              width={width} 
              height={height} 
              features={features} 
              compareFeatures={compareFeatures} 
            />
          )}
        </CustomResponsiveContainer>
      </div>

      <div className="grid grid-cols-3 gap-y-4 gap-x-2 text-center text-sm">
        <div>
          <div className="font-medium text-[#8B5CF6]">{formatPercent(features.acousticness)}</div>
          {compareFeatures && <div className="font-medium text-[#10B981] text-xs">{formatPercent(compareFeatures.acousticness)}</div>}
          <div className="text-white/40 text-[10px] mt-1">Acoustic</div>
        </div>
        <div>
          <div className="font-medium text-[#8B5CF6]">{formatPercent(features.danceability)}</div>
          {compareFeatures && <div className="font-medium text-[#10B981] text-xs">{formatPercent(compareFeatures.danceability)}</div>}
          <div className="text-white/40 text-[10px] mt-1">Dance</div>
        </div>
        <div>
          <div className="font-medium text-[#8B5CF6]">{formatPercent(features.energy)}</div>
          {compareFeatures && <div className="font-medium text-[#10B981] text-xs">{formatPercent(compareFeatures.energy)}</div>}
          <div className="text-white/40 text-[10px] mt-1">Energy</div>
        </div>
        <div>
          <div className="font-medium text-[#8B5CF6]">{formatPercent(features.instrumentalness)}</div>
          {compareFeatures && <div className="font-medium text-[#10B981] text-xs">{formatPercent(compareFeatures.instrumentalness)}</div>}
          <div className="text-white/40 text-[10px] mt-1">Instrument</div>
        </div>
        <div>
          <div className="font-medium text-[#8B5CF6]">{formatPercent(features.speechiness)}</div>
          {compareFeatures && <div className="font-medium text-[#10B981] text-xs">{formatPercent(compareFeatures.speechiness)}</div>}
          <div className="text-white/40 text-[10px] mt-1">Speech</div>
        </div>
        <div>
          <div className="font-medium text-[#8B5CF6]">{formatPercent(features.valence)}</div>
          {compareFeatures && <div className="font-medium text-[#10B981] text-xs">{formatPercent(compareFeatures.valence)}</div>}
          <div className="text-white/40 text-[10px] mt-1">Valence</div>
        </div>
      </div>
      </div>
    </GlassPanel>
  );
};
