import React from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { AudioFeatures } from '../types';

interface RightPanelProps {
  title: string;
  subtitle: string;
  features: AudioFeatures;
  compareFeatures?: AudioFeatures;
}

export const RightPanel: React.FC<RightPanelProps> = ({ title, subtitle, features, compareFeatures }) => {
  const data = [
    { subject: 'Acoustic', A: features.acousticness || 0, B: compareFeatures?.acousticness || 0, fullMark: 1 },
    { subject: 'Dance', A: features.danceability || 0, B: compareFeatures?.danceability || 0, fullMark: 1 },
    { subject: 'Energy', A: features.energy || 0, B: compareFeatures?.energy || 0, fullMark: 1 },
    { subject: 'Instrument', A: features.instrumentalness || 0, B: compareFeatures?.instrumentalness || 0, fullMark: 1 },
    { subject: 'Speech', A: features.speechiness || 0, B: compareFeatures?.speechiness || 0, fullMark: 1 },
    { subject: 'Valence', A: features.valence || 0, B: compareFeatures?.valence || 0, fullMark: 1 },
  ];

  const formatPercent = (val?: number) => val ? `${Math.round(val * 100)}%` : '0%';

  return (
    <div className="absolute right-8 top-32 w-[350px] bg-[#111]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 text-white z-20 shadow-2xl">
      <h2 className="text-xl font-medium mb-1">{title}</h2>
      <div className="text-sm text-white/50 mb-6 flex items-center gap-2">
        <div className="w-4 h-4 bg-[#8B5CF6]/50 border border-[#8B5CF6] rounded-sm" />
        {subtitle}
      </div>

      <div className="w-full h-[250px] mb-6">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="65%" data={data}>
            <PolarGrid stroke="rgba(255,255,255,0.1)" />
            <PolarAngleAxis dataKey="subject" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} />
            <PolarRadiusAxis angle={30} domain={[0, 1]} tick={false} axisLine={false} />
            <Radar name="Genre Avg" dataKey="A" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.3} />
            {compareFeatures && (
              <Radar name="Track" dataKey="B" stroke="#10B981" fill="#10B981" fillOpacity={0.4} />
            )}
          </RadarChart>
        </ResponsiveContainer>
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
  );
};
