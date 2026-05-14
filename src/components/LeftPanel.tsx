import React from 'react';
import { TrackSnapshot } from '../types';
import { SpotifyPlayer } from './SpotifyPlayer';
import { parseArtists } from '../lib/utils';

interface LeftPanelProps {
  type: 'genre' | 'track';
  title: string;
  subtitle?: string;
  description?: string;
  keyArtists?: string[];
  trackInfo?: TrackSnapshot;
  onLike?: () => void;
  onAddToPlaylist?: () => void;
  isLiked?: boolean;
  isSpotifyLoggedIn?: boolean;
}

export const LeftPanel: React.FC<LeftPanelProps> = ({ 
  type, title, subtitle, description, keyArtists, trackInfo, onLike, onAddToPlaylist, isLiked, isSpotifyLoggedIn
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
          {/* Album Art */}
          <div className="w-full aspect-square rounded-xl bg-[#222] mb-4 overflow-hidden border border-white/5">
            {trackInfo?.album_cover ? (
              <img src={trackInfo.album_cover} alt={title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-white/5 animate-pulse">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-white/15">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>
                </svg>
              </div>
            )}
          </div>

          <h2 className="text-2xl font-bold mb-1">{title}</h2>
          <div className="text-lg text-white/60 mb-4">{subtitle ? parseArtists(subtitle) : ''}</div>

          {/* Spotify Embed Player */}
          {trackInfo?.track_id && (
            <div className="mb-4">
              <SpotifyPlayer trackId={trackInfo.track_id} />
            </div>
          )}
          
          {/* Action Buttons */}
          <div className="flex gap-3">
            <button 
              onClick={() => {
                if (!isSpotifyLoggedIn) {
                  alert('Spotify 로그인이 필요합니다.\n우측 상단의 "Connect to Spotify" 버튼을 클릭하세요.');
                  return;
                }
                onLike?.();
              }}
              className={`flex-1 py-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${
                isLiked 
                  ? 'border-pink-500 bg-pink-500/20 text-pink-400' 
                  : 'border-pink-500/50 bg-pink-500/10 hover:bg-pink-500/20 text-pink-400'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill={isLiked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
              <span className="text-[10px]">{isLiked ? 'Liked' : 'Like'}</span>
            </button>
            <button 
              onClick={() => {
                if (!isSpotifyLoggedIn) {
                  alert('Spotify 로그인이 필요합니다.\n우측 상단의 "Connect to Spotify" 버튼을 클릭하세요.');
                  return;
                }
                onAddToPlaylist?.();
              }}
              className="flex-1 py-2.5 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 text-white flex flex-col items-center justify-center gap-1 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              <span className="text-[10px]">Playlist</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
