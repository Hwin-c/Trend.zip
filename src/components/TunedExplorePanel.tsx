import React, { useState } from 'react';
import { AudioFeatures } from '../types';

interface TunedExplorePanelProps {
  onExplore: (features: AudioFeatures, genre: string) => void;
}

export const TunedExplorePanel: React.FC<TunedExplorePanelProps> = ({ onExplore }) => {
  const [acousticness, setAcousticness] = useState(50);
  const [danceability, setDanceability] = useState(50);
  const [energy, setEnergy] = useState(50);
  const [instrumentalness, setInstrumentalness] = useState(0);
  const [speechiness, setSpeechiness] = useState(10);
  const [valence, setValence] = useState(50);
  
  const [genre, setGenre] = useState('Pop');

  const handleExplore = () => {
    onExplore({
      acousticness: acousticness / 100,
      danceability: danceability / 100,
      energy: energy / 100,
      instrumentalness: instrumentalness / 100,
      speechiness: speechiness / 100,
      valence: valence / 100,
    }, genre);
  };

  const renderSlider = (label: string, value: number, setter: (val: number) => void) => (
    <div className="flex flex-col items-center h-[120px]">
      <div className="text-[10px] text-white/50 mb-2 truncate max-w-full px-1">{label}</div>
      <input 
        type="range" 
        min="0" max="100" 
        value={value} 
        onChange={(e) => setter(Number(e.target.value))}
        className="h-20 appearance-none bg-white/10 w-1 rounded-full outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-[#10B981] [&::-webkit-slider-thumb]:rounded-full cursor-pointer transition-all"
        style={{ writingMode: 'bt-lr', WebkitAppearance: 'slider-vertical' } as any}
      />
      <div className="text-[10px] font-mono mt-2 text-white/80">{value}%</div>
    </div>
  );

  return (
    <div className="absolute left-8 top-32 w-[380px] bg-[#111]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 text-white z-20 shadow-2xl flex flex-col h-[520px]">
      <h2 className="text-xl font-bold mb-4">Audio Features Tuning</h2>
      
      <div className="flex-1 grid grid-cols-3 gap-y-4 gap-x-2 w-full px-2">
        {renderSlider("Acoustic", acousticness, setAcousticness)}
        {renderSlider("Dance", danceability, setDanceability)}
        {renderSlider("Energy", energy, setEnergy)}
        {renderSlider("Instrument", instrumentalness, setInstrumentalness)}
        {renderSlider("Speech", speechiness, setSpeechiness)}
        {renderSlider("Valence", valence, setValence)}
      </div>
      
      <div className="mt-4 mb-4">
        <div className="text-xs text-white/50 mb-2">Genre Selector</div>
        <select 
          value={genre} 
          onChange={(e) => setGenre(e.target.value)}
          className="w-full bg-[#222] border border-white/10 rounded-lg p-2 text-sm text-white outline-none focus:border-[#10B981] transition-colors"
        >
          <option value="Pop">Pop</option>
          <option value="Rock">Rock</option>
          <option value="Jazz">Jazz</option>
          <option value="Electronic">Electronic</option>
          <option value="Hip Hop">Hip Hop</option>
          <option value="Classical">Classical</option>
        </select>
      </div>

      <button 
        onClick={handleExplore}
        className="w-full py-3 rounded-lg bg-[#10B981]/10 hover:bg-[#10B981]/20 border border-[#10B981]/30 text-[#10B981] text-sm font-medium transition-all"
      >
        조율된 특징으로 탐색하기
        <br/><span className="text-[10px] text-[#10B981]/60 font-normal">(Explore by tuned features)</span>
      </button>
    </div>
  );
};
