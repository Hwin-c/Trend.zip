import React, { useState, useEffect } from 'react';
import { ParentGenre, SubGenre, TrackSnapshot, NodeData, AudioFeatures } from '../types';
import { parseArtists } from '../lib/utils';
import { SpotifyPlayer } from './SpotifyPlayer';
import { CustomResponsiveContainer } from './CustomResponsiveContainer';
import { CockpitRadarChart } from './CockpitRadarChart';

const MiniRadarChart: React.FC<{ features?: AudioFeatures }> = ({ features }) => {
  if (!features) return null;
  const center = 28;
  const maxRadius = 24;
  const keys: (keyof AudioFeatures)[] = [
    'acousticness',
    'danceability',
    'energy',
    'instrumentalness',
    'speechiness',
    'valence',
  ];

  const getGridPoints = (radius: number) => {
    const points = [];
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      const x = center + radius * Math.sin(angle);
      const y = center - radius * Math.cos(angle);
      points.push(`${x},${y}`);
    }
    return points.join(' ');
  };

  const getDataPoints = () => {
    const points = [];
    for (let i = 0; i < 6; i++) {
      const val = features[keys[i]] ?? 0;
      const radius = val * maxRadius;
      const angle = (i * Math.PI) / 3;
      const x = center + radius * Math.sin(angle);
      const y = center - radius * Math.cos(angle);
      points.push(`${x},${y}`);
    }
    return points.join(' ');
  };

  return (
    <svg width="56" height="56" viewBox="0 0 56 56" className="shrink-0 ml-3" style={{ filter: 'drop-shadow(0 0 6px rgba(0,255,255,0.4))' }}>
      <polygon points={getGridPoints(maxRadius)} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.8" />
      <polygon points={getGridPoints(maxRadius * 0.5)} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.8" />
      {Array.from({ length: 3 }).map((_, i) => {
        const angle = (i * Math.PI) / 3;
        const x1 = center + maxRadius * Math.sin(angle);
        const y1 = center - maxRadius * Math.cos(angle);
        const x2 = center - maxRadius * Math.sin(angle);
        const y2 = center - maxRadius * Math.cos(angle);
        return (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.15)" strokeWidth="0.8" />
        );
      })}
      <polygon points={getDataPoints()} fill="rgba(0, 255, 255, 0.4)" stroke="#00FFFF" strokeWidth="1.2" />
    </svg>
  );
};

interface TelescopeDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentNode: NodeData | null;
  allParentGenres: Pick<ParentGenre, 'id' | 'name' | 'average_audio_features'>[];
  subGenres: SubGenre[];
  genreTracks: TrackSnapshot[]; // Tracks inside selected sub/parent genre
  similarTracks: TrackSnapshot[]; // Sorted by Euclidean distance features
  onNodeClick: (node: NodeData) => void;
  spotifyLoggedIn: boolean;
  isTrackLiked: boolean;
  onLikeTrack: () => void;
  onAddToPlaylist: () => void;
  /** Force a single tab mode and hide the switcher tab navigation headers */
  forceTab?: 'list' | 'features';
}

export const TelescopeDrawer: React.FC<TelescopeDrawerProps> = ({
  isOpen,
  onClose,
  currentNode,
  allParentGenres,
  subGenres,
  genreTracks,
  similarTracks,
  onNodeClick,
  spotifyLoggedIn,
  isTrackLiked,
  onLikeTrack,
  onAddToPlaylist,
  forceTab
}) => {
  const [activeTab, setActiveTab] = useState<'features' | 'list'>('list');

  // Sync activeTab with forceTab if specified, otherwise default adaptively
  useEffect(() => {
    if (forceTab) {
      setActiveTab(forceTab);
    } else if (currentNode?.type === 'song') {
      setActiveTab('list'); // Show similar tracks by default for songs
    }
  }, [currentNode, forceTab]);

  const formatPercent = (val?: number) => (val ? `${Math.round(val * 100)}%` : '0%');

  // Determine current active node features and compare features
  const getAudioFeatures = (): { main?: AudioFeatures; compare?: AudioFeatures; title: string; subtitle: string } => {
    if (!currentNode) {
      return { title: '시스템 스캔 대기 중', subtitle: '평균 오디오 수치', main: undefined };
    }

    if (currentNode.type === 'big_genre' || currentNode.type === 'sub_genre') {
      return {
        title: `${currentNode.name}`,
        subtitle: `${currentNode.type === 'big_genre' ? '대분류' : '세부'} 장르 평균 오디오 수치`,
        main: currentNode.audioFeatures,
      };
    }

    if (currentNode.type === 'song') {
      // Find parent genre avg features
      const parentAvg = allParentGenres.find((g) => g.name === currentNode.parentGenre)?.average_audio_features;
      return {
        title: '선택 곡 오디오 피처',
        subtitle: currentNode.name,
        main: parentAvg,
        compare: currentNode.audioFeatures,
      };
    }

    return { title: '오디오 분석 수치', subtitle: '평균', main: undefined };
  };

  const featureSet = getAudioFeatures();

  const featureKeys = [
    { label: 'Acoustic', key: 'acousticness' as keyof AudioFeatures },
    { label: 'Dance', key: 'danceability' as keyof AudioFeatures },
    { label: 'Energy', key: 'energy' as keyof AudioFeatures },
    { label: 'Instrument', key: 'instrumentalness' as keyof AudioFeatures },
    { label: 'Speech', key: 'speechiness' as keyof AudioFeatures },
    { label: 'Valence', key: 'valence' as keyof AudioFeatures },
  ];

  return (
    <div className="w-full h-full text-white flex flex-col overflow-hidden font-sans relative bg-transparent">

      {/* Header (Only render when forceTab is not defined, or clean header for panels) */}
      <div className="px-4 py-2.5 border-b border-white/5 flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-base font-bold tracking-wider font-serif flex items-center gap-2 uppercase text-slate-100">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00FFFF] animate-pulse shrink-0" />
            {activeTab === 'features' ? '📡 오디오 분석' : '🗺️ 장르 탐색기'}
          </h2>
          <p className="text-sm text-[#00E5FF] font-bold mt-1 uppercase tracking-wide truncate max-w-[240px]">
            {currentNode ? `${currentNode.name} (${currentNode.type === 'big_genre' ? '대장르' : currentNode.type === 'sub_genre' ? '세부 장르' : '노래'})` : '대기 중 / 노드를 탐색하세요'}
          </p>
        </div>
      </div>

      {/* Switcher Tab Navigation - Hidden if forceTab is active to maintain dedicated widget aesthetic */}
      {!forceTab && (
        <div className="flex bg-white/5 border-b border-white/5 p-1.5 gap-1.5 shrink-0">
          <button
            onClick={() => setActiveTab('list')}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'list'
                ? 'bg-[#00FFFF] text-black shadow-lg shadow-cyan-500/20'
                : 'text-white/55 hover:text-white hover:bg-white/5'
            }`}
          >
            망원경 뷰 (Telescope)
          </button>
          <button
            onClick={() => setActiveTab('features')}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'features'
                ? 'bg-[#00FFFF] text-black shadow-lg shadow-cyan-500/20'
                : 'text-white/55 hover:text-white hover:bg-white/5'
            }`}
          >
            오디오 분석 (Features)
          </button>
        </div>
      )}

      {/* Scrollable Content Container */}
      <div className={`flex-1 p-3 ${activeTab === 'features' ? 'overflow-hidden space-y-2' : 'overflow-y-auto custom-scrollbar space-y-4'}`}>
        {activeTab === 'features' ? (
          /* --- Tab 1: Audio Features Visualization --- */
          <div className="flex flex-col gap-2.5 h-full justify-start overflow-hidden">
            {featureSet.main ? (
              <>
                <div className="text-center shrink-0">
                  <h3 className="text-sm font-bold text-slate-200 truncate">{featureSet.title}</h3>
                  <div className="text-xs text-slate-400 mt-0.5 flex items-center justify-center gap-4 font-mono">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 bg-[#8B5CF6]/60 border border-[#8B5CF6] rounded-sm" />
                      <span>{currentNode?.type === 'song' ? '장르 평균' : '장르 수치'}</span>
                    </div>
                    {featureSet.compare && (
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 bg-[#00FFFF]/70 border border-[#00FFFF] rounded-sm" />
                        <span>곡 수치</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Radar Chart */}
                <div className="w-full h-[135px] flex items-center justify-center bg-black/40 rounded-xl border border-white/5 p-1 shrink-0 shadow-inner overflow-hidden">
                  <CustomResponsiveContainer>
                    {(width, height) => (
                      <CockpitRadarChart
                        width={width}
                        height={height}
                        features={featureSet.main!}
                        compareFeatures={featureSet.compare}
                      />
                    )}
                  </CustomResponsiveContainer>
                </div>

                {/* Audio Features Metric Grid - Compact & Sleek */}
                <div className="grid grid-cols-3 gap-1 shrink-0 pb-1">
                  {featureKeys.map((f, i) => (
                    <div key={i} className="bg-white/2 border border-white/5 rounded-lg p-1 text-center shadow-sm">
                      <div className="text-[11.5px] text-slate-400 font-mono font-bold tracking-wider leading-none">{f.label}</div>
                      <div className="text-sm font-bold text-[#8B5CF6] mt-0.5 font-mono leading-none">{formatPercent(featureSet.main?.[f.key])}</div>
                      {featureSet.compare && (
                        <div className="text-sm font-bold text-[#00FFFF] mt-0.5 font-mono leading-none">{formatPercent(featureSet.compare?.[f.key])}</div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center text-white/35 h-full">
                <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="mb-3 opacity-40 animate-pulse text-[#00FFFF]"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg>
                <p className="text-sm tracking-wide text-slate-400 font-bold">시스템 스캔 대기 중</p>
                <p className="text-xs mt-1 text-white/35">중앙 은하창에서 노드를 선택해 주세요.</p>
              </div>
            )}
          </div>
        ) : (
          /* --- Tab 2: Telescope List View --- */
          <div className="space-y-3.5">
            {/* ROOT View: List all parent genres */}
            {!currentNode && (
              <div className="space-y-2.5 animate-fade-in">
                <div className="text-sm text-white/50 mb-1.5 font-mono tracking-widest">// 구역: 대장르 목록 ({allParentGenres.length})</div>
                <div className="grid grid-cols-1 gap-1.5">
                  {allParentGenres.map((genre) => (
                    <button
                      key={genre.id}
                      onClick={() => onNodeClick({ id: genre.id, type: 'big_genre', name: genre.name, x: 50, y: 50, audioFeatures: genre.average_audio_features })}
                      className="w-full text-left bg-white/2 hover:bg-white/6 border border-white/5 hover:border-cyan-500/20 rounded-xl p-2.5 flex items-center justify-between transition-all group shadow-sm cursor-pointer"
                    >
                      <div className="font-bold text-base text-slate-200 group-hover:text-[#00FFFF] transition-colors leading-snug pr-2">{genre.name}</div>
                      <MiniRadarChart features={genre.average_audio_features} />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Big Genre Landing: List sub genres */}
            {currentNode?.type === 'big_genre' && (
              <div className="space-y-2.5">
                <div className="text-sm text-white/50 mb-1.5 font-mono tracking-widest">// 구역: 세부 장르 목록 ({subGenres.length})</div>
                {subGenres.length > 0 ? (
                  <div className="grid grid-cols-1 gap-1.5">
                    {subGenres.map((sg) => (
                      <button
                        key={sg.id}
                        onClick={() => onNodeClick({ id: sg.id, type: 'sub_genre', name: sg.name, parentGenre: currentNode.name, x: 50, y: 50, audioFeatures: sg.average_audio_features })}
                        className="w-full text-left bg-white/2 hover:bg-white/6 border border-white/5 hover:border-cyan-500/20 rounded-xl p-2.5 flex items-center justify-between transition-all group cursor-pointer"
                      >
                        <span className="font-bold text-base text-slate-200 group-hover:text-[#00FFFF] transition-colors leading-snug pr-2">{sg.name}</span>
                        <MiniRadarChart features={sg.average_audio_features} />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-[#00FFFF]/60 py-8 text-center animate-pulse font-mono tracking-widest">// 세부 장르 스캔 중...</div>
                )}
              </div>
            )}

            {/* Sub Genre Landing: High Density Tracks List */}
            {currentNode?.type === 'sub_genre' && (
              <div className="space-y-2.5">
                <div className="text-sm text-white/50 mb-1.5 font-mono tracking-widest">// 구역: 수록곡 목록 ({genreTracks.length})</div>
                {genreTracks.length > 0 ? (
                  <div className="space-y-1.5">
                    {genreTracks.map((t) => (
                      <div
                        key={t.track_id}
                        onClick={() => onNodeClick({
                          id: t.track_id, type: 'song', name: t.name,
                          trackSnapshot: t, audioFeatures: t.features || { energy: t.energy, danceability: t.danceability, valence: t.valence },
                          parentGenre: currentNode.name, x: 50, y: 50
                        })}
                        className="w-full text-left bg-white/2 hover:bg-white/6 border border-white/5 rounded-xl p-2.5 flex items-center gap-2.5 transition-all cursor-pointer group relative overflow-hidden"
                      >
                        {/* Neon Green Side Indicator */}
                        <div className="w-[3px] h-full absolute left-0 top-0 bg-[#10B981] opacity-0 group-hover:opacity-100 rounded-l-md transition-opacity" />

                        <div className="w-8 h-8 bg-white/5 rounded-lg flex-shrink-0 overflow-hidden relative border border-white/5 ml-1">
                          {t.album_cover ? (
                            <img src={t.album_cover} alt={t.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[#00FFFF]/20">
                              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 pr-1">
                          <div className="font-bold text-sm text-slate-100 truncate group-hover:text-[#00FFFF] transition-colors leading-normal">{t.name}</div>
                          <div className="text-xs text-slate-400 mt-0.5 truncate">{parseArtists(t.artists)}</div>
                          <div className="w-full bg-white/5 h-0.5 rounded-full mt-1.5 overflow-hidden">
                            <div className="bg-[#10B981] h-full rounded-full" style={{ width: `${(t.energy || t.features?.energy || 0) * 100}%` }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-[#00FFFF]/60 py-8 text-center animate-pulse font-mono tracking-widest">// 수록곡 데이터 수신 중...</div>
                )}
              </div>
            )}

            {/* Track detail info & 50 similar songs ranked by Euclidean distance */}
            {currentNode?.type === 'song' && (
              <div className="space-y-4">
                {/* Song Card Detail - Sleek Futuristic Space Dashboard Style */}
                <div className="bg-black/30 border border-white/5 rounded-2xl p-2.5 flex flex-col items-center shadow-inner">
                  <div className="w-28 aspect-square bg-[#111] rounded-xl mb-2 overflow-hidden border border-white/10 relative shadow-lg">
                    {currentNode.trackSnapshot?.album_cover ? (
                      <img src={currentNode.trackSnapshot.album_cover} alt={currentNode.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-white/5 animate-pulse">
                        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-white/10">
                          <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>
                        </svg>
                      </div>
                    )}
                  </div>

                  <div className="text-center w-full px-1 mb-2">
                    <h3 className="text-base font-bold truncate text-slate-100 leading-normal">{currentNode.name}</h3>
                    <p className="text-sm text-slate-400 truncate mt-0.5">{currentNode.trackSnapshot ? parseArtists(currentNode.trackSnapshot.artists) : ''}</p>
                    <p className="text-xs text-[#00FFFF] uppercase font-mono tracking-widest mt-1 font-bold">{currentNode.parentGenre || 'GENRE_SECTOR'}</p>
                  </div>

                  {/* Player */}
                  {currentNode.trackSnapshot?.track_id && (
                    <div className="w-full">
                      <SpotifyPlayer trackId={currentNode.trackSnapshot.track_id} />
                    </div>
                  )}

                  {/* Interactive Buttons */}
                  <div className="flex gap-1.5 w-full mt-2">
                    <button
                      onClick={onLikeTrack}
                      className={`flex-1 py-2 rounded-xl border text-sm font-bold flex items-center justify-center gap-1 cursor-pointer transition-all ${
                        isTrackLiked
                          ? 'border-pink-500 bg-pink-500/20 text-pink-400'
                          : 'border-pink-500/30 bg-pink-500/2 hover:bg-pink-500/10 text-pink-400'
                      }`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill={isTrackLiked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                      {isTrackLiked ? '보관됨' : '보관'}
                    </button>
                    <button
                      onClick={onAddToPlaylist}
                      className="flex-1 py-2 rounded-xl border border-white/5 bg-white/2 hover:bg-white/6 text-slate-200 text-sm font-bold flex items-center justify-center gap-1 cursor-pointer transition-all"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                      플레이리스트
                    </button>
                  </div>
                </div>

                {/* 50 Similar tracks */}
                <div className="space-y-2">
                  <div className="text-sm text-slate-400 uppercase tracking-widest flex items-center justify-between font-mono font-bold">
                    <span>유사 곡 랭킹 (Top 50)</span>
                    <span className="text-[11px] bg-white/5 px-2 py-0.5 rounded text-white/50 uppercase">Euclidean Distance</span>
                  </div>

                  {similarTracks.length > 0 ? (
                    <div className="space-y-1.5">
                      {similarTracks.map((t, index) => (
                        <div
                          key={t.track_id}
                          onClick={() => onNodeClick({
                            id: t.track_id, type: 'song', name: t.name,
                            trackSnapshot: t, audioFeatures: t.features || { energy: t.energy, danceability: t.danceability, valence: t.valence },
                            parentGenre: currentNode.parentGenre, x: 50, y: 50
                          })}
                          className="w-full text-left bg-white/2 hover:bg-white/6 border border-white/5 rounded-xl p-2.5 flex items-center gap-2.5 transition-all cursor-pointer group relative overflow-hidden"
                        >
                          {/* Neon Cyan Side Indicator */}
                          <div className="w-[3px] h-full absolute left-0 top-0 bg-[#00FFFF] opacity-0 group-hover:opacity-100 rounded-l-md transition-opacity" />

                          <div className="text-xs font-mono font-bold text-slate-500 w-3 text-center ml-1">
                            {(index + 1).toString().padStart(2, '0')}
                          </div>
                          <div className="w-8 h-8 bg-white/5 rounded overflow-hidden relative flex-shrink-0 border border-white/5">
                            {t.album_cover ? (
                              <img src={t.album_cover} alt={t.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-white/20">
                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-sm text-slate-100 truncate group-hover:text-[#00FFFF] transition-colors leading-normal">{t.name}</div>
                            <div className="text-xs text-slate-400 mt-0.5 truncate leading-none">{parseArtists(t.artists)}</div>
                          </div>
                          <div className="text-right text-sm text-[#00FFFF] font-mono font-bold">
                            {(t as any).similarityScore !== undefined ? (
                              <span>{Math.max(0, Math.round((t as any).similarityScore * 100))}%</span>
                            ) : (
                              <span>N/A</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-[#00FFFF]/60 py-8 text-center animate-pulse font-mono tracking-widest">// 스펙트럼 분석 중...</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
