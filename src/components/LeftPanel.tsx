import React from 'react';
import { TrackSnapshot, ParentGenre, SubGenre } from '../types';

interface LeftPanelProps {
  type: 'genre' | 'track';
  title: string;
  subtitle?: string;
  description?: string;
  keyArtists?: string[];
  trackInfo?: TrackSnapshot;
  onLike?: () => void;
  onAddToPlaylist?: () => void;
  onPlay?: () => void;
}

export const LeftPanel: React.FC<LeftPanelProps> = ({ 
  type, title, subtitle, description, keyArtists, trackInfo, onLike, onAddToPlaylist, onPlay 
}) => {
  return (
    <div className="absolute left-8 top-32 w-[350px] bg-[#111]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 text-white z-20 shadow-2xl">
      {type === 'genre' ? (
        <>
          <h2 className="text-2xl font-serif mb-2">{title}</h2>
          <div className="text-sm text-white/50 mb-6">Genre Overview</div>
          <p className="text-sm text-white/80 leading-relaxed mb-8">
            {description || `Explore the sounds and key elements that define ${title}. Known for its unique style and influence.`}
          </p>
          <div className="mb-4">
            <h3 className="text-sm font-medium text-white/50 mb-3">Key Artists</h3>
            <ul className="space-y-2 text-sm">
              {keyArtists?.length ? keyArtists.map((artist, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-white/50" />
                  {artist}
                </li>
              )) : (
                <>
                  <li className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-white/50" />Top Artist 1</li>
                  <li className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-white/50" />Top Artist 2</li>
                </>
              )}
            </ul>
          </div>
          <button className="text-xs px-4 py-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
            View More
          </button>
        </>
      ) : (
        <div className="flex flex-col">
          <div className="w-full aspect-square rounded-xl bg-[#222] mb-6 overflow-hidden border border-white/5">
            {trackInfo?.album_cover ? (
              <img src={trackInfo.album_cover} alt={title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/20">
                No Cover
              </div>
            )}
          </div>
          <h2 className="text-2xl font-bold mb-1">{title}</h2>
          <div className="text-lg text-white/60 mb-6">{subtitle}</div>
          
          <div className="flex gap-4 mb-4">
            <button 
              onClick={onLike}
              className="flex-1 py-3 rounded-xl border border-pink-500/50 bg-pink-500/10 hover:bg-pink-500/20 text-pink-400 flex flex-col items-center justify-center gap-1 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
              <span className="text-xs">Like</span>
            </button>
            <button 
              onClick={onAddToPlaylist}
              className="flex-1 py-3 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 text-white flex flex-col items-center justify-center gap-1 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              <span className="text-xs">Add to Playlist</span>
            </button>
          </div>
          <button 
            onClick={onPlay}
            className="w-full py-3 rounded-full bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-medium transition-colors"
          >
            Play
          </button>
        </div>
      )}
    </div>
  );
};
