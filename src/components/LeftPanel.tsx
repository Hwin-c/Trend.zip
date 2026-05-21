import React from 'react';
import { TrackSnapshot, AudioFeatures } from '../types';
import { SpotifyPlayer } from './SpotifyPlayer';
import { parseArtists } from '../lib/utils';
import { GlassPanel } from './GlassPanel';

interface LeftPanelItem {
  id: string;
  name: string;
  type: 'big_genre' | 'sub_genre' | 'song';
  audioFeatures?: AudioFeatures;
  artists?: string | string[];
  albumCover?: string;
  rawObject?: any;
}

interface LeftPanelProps {
  type: 'genre' | 'track' | 'root';
  title: string;
  subtitle?: string;
  description?: string;
  items?: LeftPanelItem[];
  onItemClick?: (item: any) => void;
  trackInfo?: TrackSnapshot;
  onLike?: () => void;
  onAddToPlaylist?: () => void;
  isLiked?: boolean;
  isSpotifyLoggedIn?: boolean;
  exploreTab?: 'genre' | 'song';
  setExploreTab?: (tab: 'genre' | 'song') => void;
  showSubGenres?: boolean;
  onToggleSubGenres?: () => void;
  isExploreDeep?: boolean;
  isLoadingSubGenres?: boolean;
  showTabSwitcher?: boolean;
  showSubGenreToggle?: boolean;
}

// 6가지 오디오 특성을 기반으로 인라인 SVG 레이더 차트(육각형)를 그리는 초경량 컴포넌트
const MiniHexagon: React.FC<{ features?: AudioFeatures; itemType: 'big_genre' | 'sub_genre' | 'song' }> = ({ features, itemType }) => {
  if (!features) return null;

  const cx = 20;
  const cy = 20;
  const R = 15;

  const keys: (keyof AudioFeatures)[] = [
    'acousticness',
    'danceability',
    'energy',
    'instrumentalness',
    'speechiness',
    'valence'
  ];

  // 각 축의 좌표 계산 (상단 -90도부터 60도 간격 회전)
  const points = keys.map((key, i) => {
    const val = features[key] ?? 0.5;
    const angle = (i * Math.PI) / 3 - Math.PI / 2;
    const r = R * val;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    return `${x},${y}`;
  }).join(' ');

  // 외곽 한계 그리드 육각형 좌표 (v = 1.0)
  const gridPoints = keys.map((_, i) => {
    const angle = (i * Math.PI) / 3 - Math.PI / 2;
    const x = cx + R * Math.cos(angle);
    const y = cy + R * Math.sin(angle);
    return `${x},${y}`;
  }).join(' ');

  // 타입별 네온 테마 설정
  const strokeColor = itemType === 'song' ? '#00FFFF' : (itemType === 'sub_genre' ? '#F472B6' : '#93C5FD');
  const fillColor = itemType === 'song' ? 'rgba(0, 255, 255, 0.25)' : (itemType === 'sub_genre' ? 'rgba(244, 114, 182, 0.25)' : 'rgba(147, 197, 253, 0.25)');

  return (
    <div className="relative group/hex cursor-help" title={`Acoustic: ${Math.round((features.acousticness||0)*100)}% | Dance: ${Math.round((features.danceability||0)*100)}% | Energy: ${Math.round((features.energy||0)*100)}% | Instrument: ${Math.round((features.instrumentalness||0)*100)}% | Speech: ${Math.round((features.speechiness||0)*100)}% | Valence: ${Math.round((features.valence||0)*100)}%`}>
      <svg width="40" height="40" className="shrink-0 drop-shadow-[0_0_3px_rgba(0,0,0,0.5)]">
        {/* 가이드 가상 그리드선 */}
        <polygon
          points={gridPoints}
          fill="none"
          stroke="rgba(255, 255, 255, 0.08)"
          strokeWidth="1"
        />
        {/* 축 그리드 라인 */}
        {keys.map((_, i) => {
          const angle = (i * Math.PI) / 3 - Math.PI / 2;
          const x = cx + R * Math.cos(angle);
          const y = cy + R * Math.sin(angle);
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={x}
              y2={y}
              stroke="rgba(255, 255, 255, 0.04)"
              strokeWidth="0.75"
            />
          );
        })}
        {/* 실제 수치 기반 오디오 피처 육각형 다각형 */}
        <polygon
          points={points}
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth="1.5"
          className="transition-all duration-300 group-hover/hex:fill-opacity-50"
        />
        <circle cx={cx} cy={cy} r="1.2" fill="rgba(255, 255, 255, 0.7)" />
      </svg>
    </div>
  );
};

export const LeftPanel: React.FC<LeftPanelProps> = ({ 
  type, title, subtitle, description, items = [], onItemClick, trackInfo, onLike, onAddToPlaylist, isLiked, isSpotifyLoggedIn,
  exploreTab, setExploreTab, showSubGenres, onToggleSubGenres, isExploreDeep, isLoadingSubGenres,
  showTabSwitcher = false, showSubGenreToggle = false
}) => {
  return (
    <GlassPanel 
      className="w-full h-full text-white z-20 shadow-2xl flex flex-col justify-start overflow-hidden"
    >
      <div className="flex-1 min-h-0 w-full p-3 flex flex-col justify-start overflow-hidden">
        {type !== 'track' ? (
        // 1. 장르/카테고리 리스트 뷰 및 루트 디깅 목록
        <div className="flex flex-col h-full min-h-0 w-full">
          <div className="mb-4 shrink-0">
            <div className="text-[10px] text-[#00FFFF] mb-1 font-mono tracking-widest uppercase">
              {type === 'root' ? 'COCKPIT RADAR' : 'SECTOR INFO'}
            </div>
            <h2 className="text-xl font-bold truncate leading-tight">{title}</h2>
            <div className="text-xs text-white/40 mt-0.5 truncate">
              {subtitle || 'Select an item to explore its audio constellation'}
            </div>

            {/* 장르 | 노래 탭 스위처 & 세부 장르 토글 버튼 그룹 */}
            {(showTabSwitcher || showSubGenreToggle) && (
              <div className="mt-3">
                <div className="flex items-center justify-between gap-2 p-1 bg-white/[0.03] border border-white/5 rounded-xl">
                  {/* 장르 | 노래 스위처 */}
                  {showTabSwitcher && setExploreTab && exploreTab && (
                    <div className="flex items-center bg-black/40 p-0.5 rounded-lg border border-white/5">
                      <button
                        onClick={() => setExploreTab('genre')}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-all duration-300 ${
                          exploreTab === 'genre'
                            ? 'bg-gradient-to-r from-[#B026FF] to-[#7B2CBF] text-white shadow-[0_0_10px_rgba(176,38,255,0.4)] cursor-pointer'
                            : 'text-white/60 hover:text-white hover:bg-white/5 cursor-pointer'
                        }`}
                      >
                        장르
                      </button>
                      <button
                        onClick={() => setExploreTab('song')}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-all duration-300 ${
                          exploreTab === 'song'
                            ? 'bg-gradient-to-r from-[#B026FF] to-[#7B2CBF] text-white shadow-[0_0_10px_rgba(176,38,255,0.4)] cursor-pointer'
                            : 'text-white/60 hover:text-white hover:bg-white/5 cursor-pointer'
                        }`}
                      >
                        노래
                      </button>
                    </div>
                  )}

                  {/* 세부 장르 활성화 / 비활성화 버튼 */}
                  {showSubGenreToggle && onToggleSubGenres && (
                    <button
                      onClick={onToggleSubGenres}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all duration-300 flex items-center gap-1.5 cursor-pointer ${
                        showSubGenres
                          ? 'border-[#00FFFF] bg-[#00FFFF]/10 text-[#00FFFF] shadow-[0_0_10px_rgba(0,255,255,0.2)]'
                          : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${showSubGenres ? 'bg-[#00FFFF] animate-pulse' : 'bg-white/30'}`} />
                      {isLoadingSubGenres ? '로드 중...' : showSubGenres ? '세부 장르 ON' : '세부 장르 OFF'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 항목 리스트 */}
          <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-1.5 custom-scrollbar">
            {items.length > 0 ? (
              items.map((item, idx) => (
                <button
                  key={item.id || idx}
                  onClick={() => onItemClick?.(item.rawObject || item)}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 hover:border-white/10 transition-all text-left cursor-pointer group shrink-0"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* 순서 넘버 또는 수록곡 표지 */}
                    {item.albumCover ? (
                      <div className="w-8 h-8 rounded bg-white/5 overflow-hidden shrink-0 border border-white/10">
                        <img src={item.albumCover} alt={item.name} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center shrink-0 text-[10px] font-mono text-white/30 border border-white/5 group-hover:border-[#00FFFF]/20 group-hover:text-[#00FFFF]/80 transition-colors">
                        {String(idx + 1).padStart(2, '0')}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-white truncate group-hover:text-[#00FFFF] transition-colors">
                        {item.name}
                      </div>
                      {item.artists && (
                        <div className="text-[11px] text-white/45 truncate">
                          {typeof item.artists === 'string' ? parseArtists(item.artists) : parseArtists(item.artists.join(', '))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 오디오 특성 실시간 미니 육각형 시각화 */}
                  {item.audioFeatures && (
                    <div className="shrink-0 ml-3 flex items-center">
                      <MiniHexagon features={item.audioFeatures} itemType={item.type} />
                    </div>
                  )}
                </button>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="text-sm text-white/30 animate-pulse mb-2">데이터 로딩 중...</div>
                <div className="text-xs text-white/20">데이터베이스 신호를 탐색하고 있습니다</div>
              </div>
            )}
          </div>
        </div>
      ) : (
        // 2. 노래 상세 정보 및 플레이어 + 추천 유사 곡 리스트 복합 뷰
        <div className="flex flex-col h-full min-h-0 w-full overflow-y-auto pr-1 custom-scrollbar space-y-4">
          <div className="shrink-0">
            <div className="text-[10px] text-[#00FFFF] mb-1 font-mono tracking-widest uppercase">TRACK ARCHIVE</div>
            
            {/* 앨범 자켓 */}
            <div className="w-full aspect-square rounded-xl bg-[#222] mb-3 overflow-hidden border border-white/5 relative group">
              {trackInfo?.album_cover ? (
                <img src={trackInfo.album_cover} alt={title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-white/5 animate-pulse">
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-white/15">
                    <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>
                  </svg>
                </div>
              )}
            </div>

            <h2 className="text-xl font-bold mb-0.5 truncate leading-tight">{title}</h2>
            <div className="text-sm text-white/60 mb-3 truncate">{subtitle ? parseArtists(subtitle) : ''}</div>

            {/* 임베디드 스포티파이 플레이어 */}
            {trackInfo?.track_id && (
              <div className="mb-3">
                <SpotifyPlayer trackId={trackInfo.track_id} />
              </div>
            )}
            
            {/* 좋아요 & 플레이리스트 액션 단추 */}
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  if (!isSpotifyLoggedIn) {
                    alert('Spotify 로그인이 필요합니다.\n우측 상단의 "Connect to Spotify" 버튼을 클릭하세요.');
                    return;
                  }
                  onLike?.();
                }}
                className={`flex-1 py-2 rounded-xl border flex items-center justify-center gap-1.5 transition-all text-xs ${
                  isLiked 
                    ? 'border-pink-500 bg-pink-500/20 text-pink-400 font-medium' 
                    : 'border-pink-500/50 bg-pink-500/10 hover:bg-pink-500/20 text-pink-400'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill={isLiked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                <span>{isLiked ? 'Liked' : 'Like'}</span>
              </button>
              <button 
                onClick={() => {
                  if (!isSpotifyLoggedIn) {
                    alert('Spotify 로그인이 필요합니다.\n우측 상단의 "Connect to Spotify" 버튼을 클릭하세요.');
                    return;
                  }
                  onAddToPlaylist?.();
                }}
                className="flex-1 py-2 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 text-white flex items-center justify-center gap-1.5 transition-all text-xs"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                <span>Playlist</span>
              </button>
            </div>
          </div>

          {/* 유사 곡 추천 리스트 섹션 (디깅 전용 추가 레이아웃) */}
          <div className="shrink-0 pt-2 border-t border-white/5">
            <h3 className="text-xs font-mono tracking-widest text-[#00FFFF]/70 uppercase mb-2 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00FFFF] animate-ping" />
              SIMILAR NEBULA DIGS
            </h3>
            
            <div className="space-y-1.5">
              {items && items.length > 0 ? (
                items.map((item, idx) => (
                  <button
                    key={item.id || idx}
                    onClick={() => onItemClick?.(item.rawObject || item)}
                    className="w-full flex items-center justify-between p-2 rounded-lg bg-white/[0.01] hover:bg-white/[0.04] border border-white/5 transition-all text-left cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {item.albumCover ? (
                        <div className="w-7 h-7 rounded bg-white/5 overflow-hidden shrink-0 border border-white/10">
                          <img src={item.albumCover} alt={item.name} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded bg-white/5 flex items-center justify-center shrink-0 text-[9px] text-white/30 border border-white/5 font-mono">
                          {idx + 1}
                        </div>
                      )}
                      
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-white truncate group-hover:text-[#00FFFF] transition-colors">
                          {item.name}
                        </div>
                        {item.artists && (
                          <div className="text-[10px] text-white/40 truncate">
                            {typeof item.artists === 'string' ? parseArtists(item.artists) : parseArtists(item.artists.join(', '))}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {item.audioFeatures && (
                      <div className="shrink-0 ml-2">
                        <MiniHexagon features={item.audioFeatures} itemType="song" />
                      </div>
                    )}
                  </button>
                ))
              ) : (
                <div className="text-center py-4 text-xs text-white/30 animate-pulse">
                  유사곡을 불러오는 중...
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      </div>
    </GlassPanel>
  );
};
