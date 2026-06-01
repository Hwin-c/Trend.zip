import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Constellation } from './components/Constellation';
import { Minimap } from './components/Minimap';
import { DiggingProvider, useDigging } from './DiggingContext';
import { NodeData, ParentGenre, SubGenre, TrackSnapshot, AudioFeatures } from './types';
import { motion, AnimatePresence } from 'motion/react';
import {
  db, fetchHomeTrending, fetchAllGenresMetadata, fetchParentGenreById, fetchAllParentGenres,
  fetchTracksByGenre,
} from './lib/firebase';
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { LeftPanel } from './components/LeftPanel';
import { RightPanel } from './components/RightPanel';
import { SearchDropdown } from './components/SearchDropdown';
import { PlaylistModal } from './components/PlaylistModal';
import { loginWithSpotify, handleSpotifyCallback, isLoggedIn, logout, getSpotifyProfile } from './lib/spotifyAuth';
import { fetchTrackFromSpotify, fetchTracksFromSpotify, saveTrack, removeSavedTrack, checkSavedTrack, extractPlaylistId } from './lib/spotify';
import { parseArtists, isValidUrl } from './lib/utils';
import { GlassPanel } from './components/GlassPanel';
import spaceshipTexture from './assets/spaceship_texture.webp';
import spaceshipTextureB from './assets/spaceship_texture_B.webp';
import spaceshipTextureC from './assets/spaceship_texture_C.webp';
import spaceNebulaBg from './assets/space_nebula_bg.webp';
import { LandscapeGuide } from './components/LandscapeGuide';
import { CockpitFrame } from './components/CockpitFrame';


// SVG Icons
const SearchIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  </svg>
);

const UserIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>
  </svg>
);

const SpotifyIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.54.659.301 1.02zm1.44-3.3c-.301.42-.84.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.02.6-1.14 4.32-1.38 9.72-.66 13.44 1.62.42.24.54.78.301 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.6.18-1.2.72-1.38 4.26-1.26 11.28-1.02 15.72 1.62.539.3.719 1.02.419 1.56-.299.54-1.02.72-1.559.42z" />
  </svg>
);

function MainApp() {
  const [mode, setMode] = useState<'home' | 'explore'>('home');
  const [exploreTab, setExploreTab] = useState<'genre' | 'song'>('genre');
  const [showSubGenres, setShowSubGenres] = useState<boolean>(false);
  const [currentNode, setCurrentNode] = useState<NodeData | null>(null);
  const { addToLog, clearLog } = useDigging();

  // 프리셋 테마 RGB 정의 테이블
  const THEME_PRESETS = useMemo(() => ({
    cyan: '0, 255, 255',
    purple: '176, 38, 255',
    amber: '255, 140, 0',
    green: '0, 255, 102',
  }), []);

  // 1. 테마 모드 영속화 세션 로드 (기본값: 'original')
  const [hullThemeMode, setHullThemeMode] = useState<'original' | 'cyan' | 'purple' | 'amber' | 'green' | 'custom'>(() => {
    const saved = localStorage.getItem('dbdigging_hull_theme_mode');
    return (saved === 'original' || saved === 'cyan' || saved === 'purple' || saved === 'amber' || saved === 'green' || saved === 'custom') ? saved : 'original';
  });

  // 2. 커스텀 RGB 상태 로드 (기본값: '255, 0, 175' - 네온 핫핑크)
  const [customRgb, setCustomRgb] = useState<string>(() => {
    return localStorage.getItem('dbdigging_custom_rgb') || '255, 0, 175';
  });

  // 3. activeRgb 텍스트 실시간 계산
  const activeRgb = useMemo(() => {
    if (hullThemeMode === 'custom') {
      return customRgb;
    }
    if (hullThemeMode === 'original') {
      return '0, 0, 0';
    }
    return THEME_PRESETS[hullThemeMode] || THEME_PRESETS.cyan;
  }, [hullThemeMode, customRgb, THEME_PRESETS]);

  // 실시간 밝기(Luminance) 판별
  const isLightHull = useMemo(() => {
    if (hullThemeMode === 'original') return false; // 원본 메탈은 차분한 어두운 톤이므로 흰 글씨 유지
    const rgbValues = activeRgb.split(',').map(Number);
    if (rgbValues.length !== 3 || rgbValues.some(isNaN)) return false;
    const [r, g, b] = rgbValues;
    
    // W3C 표준 relative luminance/brightness 공식
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 150; // 밝기 150을 기준으로 텍스트 색 전환 결정
  }, [activeRgb, hullThemeMode]);

  // 패턴 테마 로컬스토리지 바인딩
  const [patternTheme, setPatternTheme] = useState<'default' | 'pattern_b' | 'pattern_c'>(() => {
    const saved = localStorage.getItem('dbdigging_pattern_theme');
    return (saved === 'default' || saved === 'pattern_b' || saved === 'pattern_c') ? saved : 'default';
  });

  // 활성화된 텍스처 리소스 매칭
  const activeTexture = useMemo(() => {
    switch (patternTheme) {
      case 'pattern_b': return spaceshipTextureB;
      case 'pattern_c': return spaceshipTextureC;
      default: return spaceshipTexture;
    }
  }, [patternTheme]);

  // 콕핏 패널 외벽 스타일 생성 헬퍼 (마감 섀도우 및 보더 트랜지션 확장)
  const getHullStyle = useCallback((gridStyles: React.CSSProperties) => {
    const baseStyle: React.CSSProperties = {
      ...gridStyles,
      backgroundImage: `url(${activeTexture})`,
      backgroundRepeat: 'repeat',
      backgroundSize: '512px 512px', // 512px * 512px 텍스처 규격 통일
      boxShadow: 'inset 0 0 25px rgba(0, 0, 0, 0.75)', // 입체감 있는 메탈 엠보싱 마감 효과 추가
      transition: 'background-color 0.5s ease, background-image 0.3s ease, color 0.5s ease, border-color 0.5s ease',
    };

    if (hullThemeMode === 'original') {
      return baseStyle;
    }

    return {
      ...baseStyle,
      backgroundColor: `rgba(${activeRgb}, 0.22)`, // 연하고 부드러운 틴트로 변경
      backgroundBlendMode: 'overlay',
    };
  }, [hullThemeMode, activeRgb, activeTexture]);

  // 스킨 테마 변경 핸들러
  const handleThemeModeChange = (mode: 'original' | 'cyan' | 'purple' | 'amber' | 'green' | 'custom') => {
    setHullThemeMode(mode);
    localStorage.setItem('dbdigging_hull_theme_mode', mode);
    
    const modeNames = { 
      original: '오리지널 메탈', 
      cyan: '네온 사이언', 
      purple: '사이버 퍼플', 
      amber: '솔라 엠버', 
      green: '매트릭스 그린', 
      custom: '사용자 지정' 
    };
    showToast(`조종선 테마를 [${modeNames[mode]}] 색채로 튜닝했습니다.`, 'info');
  };

  // 패턴 변경 핸들러
  const handlePatternChange = (pattern: 'default' | 'pattern_b' | 'pattern_c') => {
    setPatternTheme(pattern);
    localStorage.setItem('dbdigging_pattern_theme', pattern);
    
    const patternNames = { default: '패턴A', pattern_b: '패턴B', pattern_c: '패턴C' };
    showToast(`조종선 텍스처를 [${patternNames[pattern]}]으로 스왑했습니다.`, 'info');
  };

  // 커스텀 컬러 피커 변경 핸들러 (Hex to RGB 파싱 후 바인딩)
  const handleCustomColorChange = (hexColor: string) => {
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
    const rgbString = `${r}, ${g}, ${b}`;
    
    setCustomRgb(rgbString);
    setHullThemeMode('custom');
    localStorage.setItem('dbdigging_hull_theme_mode', 'custom');
    localStorage.setItem('dbdigging_custom_rgb', rgbString);
  };

  const [homeTrending, setHomeTrending] = useState<TrackSnapshot[]>([]);
  const [chartViewMode, setChartViewMode] = useState<'list' | 'player'>('list');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [allGenresMeta, setAllGenresMeta] = useState<Pick<ParentGenre, 'id' | 'name' | 'average_audio_features'>[]>([]);
  const [cachedGenres, setCachedGenres] = useState<Map<string, ParentGenre>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // Prevent duplicate Spotify API calls for the same track ID concurrently
  const pendingFetches = useRef<Set<string>>(new Set());

  const [isLoadingSubGenres, setIsLoadingSubGenres] = useState(false);

  // 헬퍼 함수: parentName(대장르 또는 세부 장르 이름)을 이용해 부모의 average_audio_features 조회
  const getParentGenreFeatures = useCallback((parentName?: string): AudioFeatures | undefined => {
    if (!parentName) return undefined;
    
    const parentNameLower = parentName.toLowerCase();
    
    // 1. cachedGenres 내부의 세부 장르 중 일치하는 것이 있는지 탐색
    for (const [_, parentGenre] of cachedGenres.entries()) {
      if (parentGenre.sub_genres_data) {
        const sub = parentGenre.sub_genres_data.find(sg => sg.name.toLowerCase() === parentNameLower);
        if (sub && sub.average_audio_features) {
          return sub.average_audio_features;
        }
      }
    }
    
    // 2. 대분류 메타데이터에서 일치하는 것이 있는지 탐색
    const big = allGenresMeta.find(g => g.name.toLowerCase() === parentNameLower);
    if (big && big.average_audio_features) {
      return big.average_audio_features;
    }
    
    return undefined;
  }, [cachedGenres, allGenresMeta]);



  // 헬퍼 함수: parentName이 세부 장르인지 대분류 장르인지 판단
  const isSubGenre = useCallback((genreName?: string): boolean => {
    if (!genreName) return false;
    const nameLower = genreName.toLowerCase();
    for (const [_, parentGenre] of cachedGenres.entries()) {
      if (parentGenre.sub_genres_data) {
        const found = parentGenre.sub_genres_data.some(sg => sg.name.toLowerCase() === nameLower);
        if (found) return true;
      }
    }
    return false;
  }, [cachedGenres]);

  // Position cache for smooth sub-genre toggle (no re-layout of existing nodes)
  const [nodePositionCache, setNodePositionCache] = useState<Map<string, { x: number; y: number }>>(new Map());

  const handlePositionsSettled = useCallback((positions: Map<string, { x: number; y: number }>) => {
    setNodePositionCache(positions);
  }, []);

  // Deep Dive Pagination State
  const [deepTracks, setDeepTracks] = useState<TrackSnapshot[]>([]);
  const [isDeepDiving, setIsDeepDiving] = useState(false);

  // Premium Toast Notification State
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'info' | 'error'>('info');

  const showToast = useCallback((msg: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage(msg);
    setToastType(type);
  }, []);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Spotify Auth State
  const [spotifyLoggedIn, setSpotifyLoggedIn] = useState(isLoggedIn());
  const [spotifyProfile, setSpotifyProfile] = useState<{ display_name: string; images: { url: string }[] } | null>(null);
  const [isTrackLiked, setIsTrackLiked] = useState(false);
  const [isLikeUpdating, setIsLikeUpdating] = useState(false);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [playlistTargetTrack, setPlaylistTargetTrack] = useState<{ id: string; name: string } | null>(null);

  // Handle Spotify OAuth callback on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('code')) {
      handleSpotifyCallback().then(token => {
        if (token) {
          setSpotifyLoggedIn(true);
          getSpotifyProfile().then(p => {
            setSpotifyProfile(p);
            showToast(`${p?.display_name || '사용자'}님, Spotify 계정이 성공적으로 연동되었습니다!`, 'success');
          });
        }
      });
    } else if (isLoggedIn()) {
      getSpotifyProfile().then(p => setSpotifyProfile(p));
    }
  }, [showToast]);

  // Check if current track is liked when viewing a song
  useEffect(() => {
    if (currentNode?.type === 'song' && currentNode.trackSnapshot && spotifyLoggedIn) {
      checkSavedTrack(currentNode.trackSnapshot.track_id).then(setIsTrackLiked);
    } else {
      setIsTrackLiked(false);
    }
  }, [currentNode, spotifyLoggedIn]);

  const handleSpotifyLogin = () => {
    if (spotifyLoggedIn) {
      if (window.confirm('로그아웃하시겠습니까?')) {
        logout();
        setSpotifyLoggedIn(false);
        setSpotifyProfile(null);
        showToast('Spotify 연동이 해제되었습니다.', 'info');
      }
    } else {
      loginWithSpotify();
    }
  };

  const handleLikeTrack = async () => {
    if (!currentNode?.trackSnapshot || isLikeUpdating) return;
    setIsLikeUpdating(true);
    const trackId = currentNode.trackSnapshot.track_id;
    const trackName = currentNode.trackSnapshot.name;
    
    try {
      if (isTrackLiked) {
        const success = await removeSavedTrack(trackId);
        if (success) {
          setIsTrackLiked(false);
          showToast(`"${trackName}"을(를) 좋아요 목록에서 제거했습니다.`, 'info');
        } else {
          showToast('좋아요 취소에 실패했습니다. 세션을 확인해 주세요.', 'error');
        }
      } else {
        const success = await saveTrack(trackId);
        if (success) {
          setIsTrackLiked(true);
          showToast(`"${trackName}"을(를) 좋아요 목록에 추가했습니다!`, 'success');
        } else {
          showToast('좋아요 추가에 실패했습니다. 권한을 확인해 주세요.', 'error');
        }
      }
    } catch (error) {
      console.error(error);
      showToast('Spotify API 연동에 실패했습니다.', 'error');
    } finally {
      setIsLikeUpdating(false);
    }
  };

  const handleAddToPlaylist = () => {
    if (!currentNode?.trackSnapshot) return;
    setPlaylistTargetTrack({ id: currentNode.trackSnapshot.track_id, name: currentNode.trackSnapshot.name });
    setShowPlaylistModal(true);
  };

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Close search dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchSelectGenre = async (genre: Pick<ParentGenre, 'id' | 'name' | 'average_audio_features'>) => {
    setMode('explore');
    setExploreTab('genre');
    // Fetch full genre data if not cached
    if (!cachedGenres.has(genre.id)) {
      const fullGenre = await fetchParentGenreById(genre.id);
      if (fullGenre) {
        setCachedGenres(prev => new Map(prev).set(genre.id, fullGenre));
      }
    }
    setCurrentNode({ id: genre.id, type: 'big_genre', name: genre.name, x: 50, y: 50, audioFeatures: genre.average_audio_features });
    setSearchQuery('');
  };

  const handleToggleSubGenres = async () => {
    if (!showSubGenres) {
      if (cachedGenres.size < allGenresMeta.length) {
        setIsLoadingSubGenres(true);
        const allFull = await fetchAllParentGenres();
        setCachedGenres(prev => {
          const next = new Map(prev);
          allFull.forEach(g => next.set(g.id, g));
          return next;
        });
        setIsLoadingSubGenres(false);
      }
      setShowSubGenres(true);
    } else {
      setShowSubGenres(false);
    }
  };

  const handleSearchSelectTrack = (track: TrackSnapshot, parentGenreName: string) => {
    setMode('explore');
    setExploreTab('song');
    const node: NodeData = {
      id: track.track_id,
      type: 'song',
      name: track.name,
      x: 50,
      y: 50,
      trackSnapshot: track,
      audioFeatures: track.features,
      parentGenre: parentGenreName
    };
    handleNodeClick(node);
    setSearchQuery('');
  };

  useEffect(() => {
    // Only 2 Read ops on mount
    Promise.all([fetchHomeTrending(), fetchAllGenresMetadata()]).then(([trendingRes, genresRes]) => {
      if (trendingRes?.trending_tracks) {
        setHomeTrending(trendingRes.trending_tracks);
      }
      if (genresRes?.genres) {
        setAllGenresMeta(genresRes.genres);
      }
      setIsLoading(false);
    });
  }, []);

  const handleRefreshSongs = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleWheelScroll = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.deltaY !== 0) {
      e.currentTarget.scrollLeft += e.deltaY;
    }
  };

  const resetToHome = () => {
    setMode('home');
    setCurrentNode(null);
    setDeepTracks([]);
  };

  useEffect(() => {
    if (mode === 'home') {
      clearLog();
    }
  }, [mode, clearLog]);

  const handleNodeClick = async (node: NodeData) => {
    // 방어 코드: 노드 ID가 가짜 ID이거나 누락된 경우, 이름 매칭을 통해 실제 ID로 보완 복원
    if (node.type === 'big_genre' && (node.id === 'parent_genre_node' || !node.id) && node.name) {
      const actualMeta = allGenresMeta.find(g => g.name.toLowerCase() === node.name.toLowerCase());
      if (actualMeta) {
        node = {
          ...node,
          id: actualMeta.id,
          audioFeatures: node.audioFeatures || actualMeta.average_audio_features
        };
      }
    } else if (node.type === 'sub_genre' && (node.id === 'sg1' || !node.id) && node.name) {
      let foundSubId = '';
      let parentGenreName = node.parentGenre || '';
      for (const [_, parentGenre] of cachedGenres.entries()) {
        if (parentGenre.sub_genres_data) {
          const sub = parentGenre.sub_genres_data.find(s => s.name.toLowerCase() === node.name.toLowerCase());
          if (sub) {
            foundSubId = sub.id;
            parentGenreName = parentGenreName || parentGenre.name;
            break;
          }
        }
      }
      if (foundSubId) {
        node = {
          ...node,
          id: foundSubId,
          parentGenre: parentGenreName
        };
      }
    }

    addToLog(node.id, node.name, node.type);
    if (mode === 'home') return;

    // Clear deep tracks on navigation
    setDeepTracks([]);

    // Extreme Denormalization: Fetch Full ParentGenre only once
    if (node.type === 'big_genre') {
      let fullGenre = cachedGenres.get(node.id);
      if (!fullGenre) {
        fullGenre = await fetchParentGenreById(node.id);
        if (fullGenre) {
          setCachedGenres(prev => new Map(prev).set(node.id, fullGenre!));
        }
      }
      
      // 대장르 top_tracks 앨범 자켓 비동기 로드 복원 루프
      if (fullGenre && fullGenre.top_tracks) {
        const targetGenreId = node.id;
        const tracksToFetch = fullGenre.top_tracks.filter(track => {
          const hasCover = isValidUrl(track.album_cover) || isValidUrl((track as any).album_art);
          return !hasCover && !pendingFetches.current.has(track.track_id);
        });

        if (tracksToFetch.length > 0) {
          tracksToFetch.forEach(t => pendingFetches.current.add(t.track_id));
          
          fetchTracksFromSpotify(tracksToFetch.map(t => t.track_id)).then(trackInfoMap => {
            setCachedGenres(prev => {
              const next = new Map(prev);
              const genre = next.get(targetGenreId) as ParentGenre | undefined;
              if (genre && genre.top_tracks) {
                const updatedTracks = genre.top_tracks.map(track => {
                  const info = trackInfoMap[track.track_id];
                  if (info?.album_art) {
                    return { ...track, album_cover: info.album_art };
                  }
                  return track;
                });
                next.set(targetGenreId, { ...genre, top_tracks: updatedTracks } as ParentGenre);
              }
              return next;
            });
          }).finally(() => {
            tracksToFetch.forEach(t => pendingFetches.current.delete(t.track_id));
          });
        }
      }
    }

    // Bug 3 fix: sub_genre tracks must be fetched from 'tracks' collection
    // because sub_genres_data in the DB does NOT contain top_tracks
    if (node.type === 'sub_genre' && !node.topTracks) {
      const tracks = await fetchTracksByGenre(node.name, 20);
      const mapped: TrackSnapshot[] = tracks.map(t => ({
        track_id: t.track_id,
        name: t.name,
        artists: t.artists,
        album_cover: (t as any).album_cover || (t as any).album_art,
        energy: t.audio_features?.energy,
        danceability: t.audio_features?.danceability,
        valence: t.audio_features?.valence,
        features: t.audio_features,
      }));
      node = { ...node, topTracks: mapped };

      // Async visual cover restoration loop for sub_genre tracks
      const subGenreTracksToFetch = mapped.filter(track => {
        return !isValidUrl(track.album_cover) && !pendingFetches.current.has(track.track_id);
      });

      if (subGenreTracksToFetch.length > 0) {
        const currentNodeId = node.id;
        subGenreTracksToFetch.forEach(t => pendingFetches.current.add(t.track_id));

        fetchTracksFromSpotify(subGenreTracksToFetch.map(t => t.track_id)).then(trackInfoMap => {
          setCurrentNode(prev => {
            if (!prev || prev.id !== currentNodeId || prev.type !== 'sub_genre') return prev;
            const updatedTracks = (prev.topTracks || []).map(track => {
              const info = trackInfoMap[track.track_id];
              if (info?.album_art) {
                return { ...track, album_cover: info.album_art };
              }
              return track;
            });
            return { ...prev, topTracks: updatedTracks };
          });
        }).finally(() => {
          subGenreTracksToFetch.forEach(t => pendingFetches.current.delete(t.track_id));
        });
      }
    }

    // Fetch similar tracks dynamically from Firestore for song nodes
    if (node.type === 'song' && node.trackSnapshot && !node.similarTracks) {
      const trackSnap = node.trackSnapshot;
      (async () => {
        try {
          const trackDocRef = doc(db, 'tracks', trackSnap.track_id);
          const trackDocSnap = await getDoc(trackDocRef);
          let primaryGenre = '';
          let parentGenreName = '';
          
          if (trackDocSnap.exists()) {
            const trackData = trackDocSnap.data();
            const genreList = trackData.Genre_List || [];
            primaryGenre = genreList[0] || '';
            const parentGenreList = trackData.Parent_Genre_List || [];
            parentGenreName = parentGenreList[0] || '';
          }
          
          if (primaryGenre) {
            const tracksRef = collection(db, 'tracks');
            const q = query(
              tracksRef,
              where("Genre_List", "array-contains", primaryGenre),
              orderBy("popularity_score", "desc"),
              limit(10)
            );
            const snapshot = await getDocs(q);
            const fetchedTracks: TrackSnapshot[] = snapshot.docs.map(doc => {
              const data = doc.data();
              return {
                track_id: doc.id,
                name: data.name,
                artists: data.artists,
                album_cover: data.album_cover || data.album_art,
                energy: data.audio_features?.energy,
                danceability: data.audio_features?.danceability,
                valence: data.audio_features?.valence,
                features: data.audio_features,
              };
            });
            
            const filtered = fetchedTracks
              .filter(t => t.track_id !== trackSnap.track_id)
              .slice(0, 5);
              
            setCurrentNode(prev => {
              if (!prev || prev.id !== node.id) return prev;
              
              // Preserve already-restored album_cover data from Spotify async fetch
              const currentCover = prev.trackSnapshot?.album_cover || node.trackSnapshot?.album_cover;
              
              return {
                ...prev,
                similarTracks: filtered,
                parentGenre: parentGenreName || prev.parentGenre,
                subGenre: primaryGenre || prev.subGenre,
                trackSnapshot: prev.trackSnapshot ? {
                  ...prev.trackSnapshot,
                  album_cover: currentCover
                } : prev.trackSnapshot
              };
            });
            
            // Async cover restoration loop for similar tracks
            const similarTracksToFetch = filtered.filter(track => {
              return !isValidUrl(track.album_cover) && !pendingFetches.current.has(track.track_id);
            });

            if (similarTracksToFetch.length > 0) {
              const currentNodeId = node.id;
              similarTracksToFetch.forEach(t => pendingFetches.current.add(t.track_id));

              fetchTracksFromSpotify(similarTracksToFetch.map(t => t.track_id)).then(trackInfoMap => {
                setCurrentNode(prev => {
                  if (!prev || prev.id !== currentNodeId || prev.type !== 'song') return prev;
                  const updatedSimilar = (prev.similarTracks || []).map(track => {
                    const info = trackInfoMap[track.track_id];
                    if (info?.album_art) {
                      return { ...track, album_cover: info.album_art };
                    }
                    return track;
                  });
                  return { ...prev, similarTracks: updatedSimilar };
                });
              }).finally(() => {
                similarTracksToFetch.forEach(t => pendingFetches.current.delete(t.track_id));
              });
            }
          }
        } catch (error) {
          console.error("Error loading similar tracks from Firestore:", error);
        }
      })();
    }

    // Fetch album art from Spotify for song nodes (self)
    if (node.type === 'song' && node.trackSnapshot && !isValidUrl(node.trackSnapshot.album_cover)) {
      const trackId = node.trackSnapshot.track_id;
      if (!pendingFetches.current.has(trackId)) {
        pendingFetches.current.add(trackId);
        fetchTrackFromSpotify(trackId).then(info => {
          if (info?.album_art) {
            setCurrentNode(prev => {
              if (!prev || prev.id !== node.id) return prev;
              return {
                ...prev,
                trackSnapshot: { ...prev.trackSnapshot!, album_cover: info.album_art },
              };
            });
          }
        }).finally(() => {
          pendingFetches.current.delete(trackId);
        });
      }
    }

    setCurrentNode(node);
  };

  // 헬퍼 함수: parentName을 기반으로 NodeData에 들어갈 정보를 온전히 찾아와 복원
  const handleRestoreParentNode = useCallback((parentName?: string) => {
    if (!parentName) {
      setCurrentNode(null);
      return;
    }
    
    const parentNameLower = parentName.toLowerCase();
    
    // 1. 세부 장르 중 일치하는 것이 있는지 탐색
    for (const [_, parentGenre] of cachedGenres.entries()) {
      if (parentGenre.sub_genres_data) {
        const sub = parentGenre.sub_genres_data.find(sg => sg.name.toLowerCase() === parentNameLower);
        if (sub) {
          handleNodeClick({
            id: sub.id,
            type: 'sub_genre',
            name: sub.name,
            parentGenre: parentGenre.name,
            audioFeatures: sub.average_audio_features
          });
          return;
        }
      }
    }
    
    // 2. 대장르 중 일치하는 것이 있는지 탐색
    const big = allGenresMeta.find(g => g.name.toLowerCase() === parentNameLower);
    if (big) {
      handleNodeClick({
        id: big.id,
        type: 'big_genre',
        name: big.name,
        audioFeatures: big.average_audio_features
      });
      return;
    }
    
    setCurrentNode(null);
  }, [cachedGenres, allGenresMeta, handleNodeClick]);

  const [fovScale, setFovScale] = useState(0);

  const triggerOpticsCompensation = useCallback(() => {
    const startTime = performance.now();
    const duration = 1800; // 1.8초 차원 도약 워프 오버레이 시간과 정렬

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      let currentFOV = 0;
      if (progress < 0.45) {
        // 0% -> 45%: Reverse Lens Distortion 극대화 (0에서 -180까지 둥글게 빨려 들어감)
        const t = progress / 0.45;
        currentFOV = -180 * (t * t);
      } else if (progress < 0.7) {
        // 45% -> 70%: 렌즈 굴절 정점 유지 (-180 부근)
        currentFOV = -180;
      } else {
        // 70% -> 100%: 새 성계로 랜딩하며 렌즈 왜곡 부드럽게 0으로 수축 (복원)
        const t = (progress - 0.7) / 0.3;
        const easeOut = 1 - Math.pow(1 - t, 3); // cubic ease-out
        currentFOV = -180 * (1 - easeOut);
      }

      setFovScale(currentFOV);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setFovScale(0);
      }
    };

    requestAnimationFrame(animate);
  }, []);

  const startExploreMode = (tab: 'genre' | 'song') => {
    setIsTransitioning(true);
    triggerOpticsCompensation(); // AE Optics Compensation 스탑워치 가동!
    
    // Delay actual exploration cockpit mounting to match the hyperdrive blast peak (0.8s)
    setTimeout(() => {
      setMode('explore');
      setExploreTab(tab);
      setCurrentNode(null);
      setDeepTracks([]);
    }, 800);

    // End transition overlay and allow interactions after 1.8s
    setTimeout(() => {
      setIsTransitioning(false);
    }, 1800);
  };

  const handleDeepDive = async () => {
    if (!currentNode) return;
    setIsDeepDiving(true);
    const newTracks = await fetchTracksByGenre(currentNode.name, 20);
    const mappedTracks: TrackSnapshot[] = newTracks.map(t => ({
      track_id: t.track_id,
      name: t.name,
      artists: t.artists,
      album_cover: (t as any).album_cover || (t as any).album_art,
      energy: t.audio_features?.energy,
      danceability: t.audio_features?.danceability,
      valence: t.audio_features?.valence,
      features: t.audio_features
    }));
    setDeepTracks(prev => [...prev, ...mappedTracks]);

    // Async restoration loop for deep tracks
    const deepTracksToFetch = mappedTracks.filter(track => {
      return !isValidUrl(track.album_cover) && !pendingFetches.current.has(track.track_id);
    });

    if (deepTracksToFetch.length > 0) {
      deepTracksToFetch.forEach(t => pendingFetches.current.add(t.track_id));

      fetchTracksFromSpotify(deepTracksToFetch.map(t => t.track_id)).then(trackInfoMap => {
        setDeepTracks(prev => {
          return prev.map(track => {
            const info = trackInfoMap[track.track_id];
            if (info?.album_art) {
              return { ...track, album_cover: info.album_art };
            }
            return track;
          });
        });
      }).finally(() => {
        deepTracksToFetch.forEach(t => pendingFetches.current.delete(t.track_id));
      });
    }

    setIsDeepDiving(false);
  };

  // Node Calculation Logic
  const displayNodes = useMemo(() => {
    if (mode === 'home') return [];

    if (!currentNode) {
      // Root View: Parent Genres (Limit to 30)
      const visibleParentGenres = allGenresMeta.slice(0, 30);
      const nodes: NodeData[] = visibleParentGenres.map((pg) => {
        const cached = nodePositionCache.get(pg.id);
        return {
          id: pg.id, type: 'big_genre', name: pg.name,
          x: cached?.x ?? (Math.random() - 0.5) * 400,
          y: cached?.y ?? (Math.random() - 0.5) * 400,
          // If position is cached, fix it so physics won't move it
          _fx: cached?.x, _fy: cached?.y,
          audioFeatures: pg.average_audio_features,
          // Already visible nodes don't fade in
          _birthTime: cached ? undefined : Date.now(),
        } as any;
      });

      if (showSubGenres) {
        visibleParentGenres.forEach((pg) => {
          const cachedGenre = cachedGenres.get(pg.id);
          const parentNode = nodes.find(n => n.id === pg.id);
          if (cachedGenre?.sub_genres_data && parentNode) {
            cachedGenre.sub_genres_data.forEach((sg, idx) => {
              const angle = (idx / cachedGenre.sub_genres_data!.length) * Math.PI * 2;
              const distance = 60 + Math.random() * 30;
              nodes.push({
                id: sg.id, type: 'sub_genre', name: sg.name, parentGenre: pg.name, parentId: pg.id,
                x: (parentNode.x || 0) + Math.cos(angle) * distance,
                y: (parentNode.y || 0) + Math.sin(angle) * distance,
                audioFeatures: sg.average_audio_features,
                _birthTime: Date.now(), // New nodes: fade-in
              } as any);
            });
          }
        });
      }
      return nodes;
    }

    if (currentNode.type === 'big_genre' || currentNode.type === 'sub_genre') {
      // For a sub_genre, we look into the parent's cached sub_genres if needed, 
      // but if the node itself has its data, we use it.

      const parentData = currentNode.type === 'big_genre' ? cachedGenres.get(currentNode.id) : null;

      if (exploreTab === 'genre') {
        if (currentNode.type === 'big_genre') {
          // Show Sub Genres
          const sgs = parentData?.sub_genres_data || [];
          const subGenreNodes = sgs.map((sg) => {
            return {
              id: sg.id, type: 'sub_genre', name: sg.name, parentGenre: currentNode.name,
              x: (Math.random() - 0.5) * 600, y: (Math.random() - 0.5) * 600,
              audioFeatures: sg.average_audio_features
            };
          });
          return [
            { id: currentNode.id, type: currentNode.type, name: currentNode.name, x: 0, y: 0 },
            ...subGenreNodes
          ] as NodeData[];
        } else {
          // Sub-genre: Show parent genre + 5 top tracks
          const parentGenreMeta = allGenresMeta.find(
            g => g.name.toLowerCase() === (currentNode.parentGenre || '').toLowerCase()
          );
          const parentNodeId = parentGenreMeta ? parentGenreMeta.id : 'parent_genre_node';

          const parentNode: NodeData = {
            id: parentNodeId, type: 'big_genre', name: currentNode.parentGenre || 'Parent Genre',
            x: (Math.random() - 0.5) * 300, y: (Math.random() - 0.5) * 300
          };
          
          const similarSongs = (currentNode.topTracks || []).slice(0, 5).map(t => ({
            id: t.track_id, type: 'song', name: t.name,
            x: (Math.random() - 0.5) * 300, y: (Math.random() - 0.5) * 300,
            trackSnapshot: t,
            audioFeatures: t.features || { energy: t.energy, danceability: t.danceability, valence: t.valence },
            parentGenre: currentNode.name
          })) as NodeData[];

          return [
            { id: currentNode.id, type: currentNode.type, name: currentNode.name, x: 0, y: 0 },
            parentNode,
            ...similarSongs
          ];
        }
      } else {
        // Show top 50 Songs with refresh/shuffle logic
        // If sub_genre, its topTracks are in currentNode.topTracks.
        // If big_genre, its topTracks are in parentData.top_tracks.
        const sourceTracks = currentNode.type === 'sub_genre' ? currentNode.topTracks : parentData?.top_tracks;
        let tracks = [...(sourceTracks || [])];
        if (refreshKey > 0) {
          // Shuffle tracks randomly if refresh button was clicked
          tracks = tracks.sort(() => Math.random() - 0.5);
        }
        tracks = tracks.slice(0, 50);

        // Append dynamically fetched deep tracks
        tracks = [...tracks, ...deepTracks];

        const songNodes = tracks.map((t) => {
          return {
            id: t.track_id, type: 'song', name: t.name,
            x: (Math.random() - 0.5) * 600, y: (Math.random() - 0.5) * 600,
            trackSnapshot: t,
            // Bug 2 fix: DB top_tracks don't have .features, use individual fields as fallback
            audioFeatures: t.features || { energy: t.energy, danceability: t.danceability, valence: t.valence },
            parentGenre: currentNode.name
          };
        });
        return [
          { id: currentNode.id, type: currentNode.type, name: currentNode.name, x: 0, y: 0 },
          ...songNodes
        ] as NodeData[];
      }
    }

    if (currentNode.type === 'song') {
      // Show similar songs & related entities
      const nodes: NodeData[] = [
        { 
          id: currentNode.id, 
          type: 'song', 
          name: currentNode.name, 
          x: 0, 
          y: 0,
          trackSnapshot: currentNode.trackSnapshot,
          audioFeatures: currentNode.audioFeatures,
          parentGenre: currentNode.parentGenre,
          subGenre: currentNode.subGenre
        }
      ];

      const parentGenreName = currentNode.parentGenre || 'Genre';
      
      // 실제 대장르 ID 찾기 (allGenresMeta 매칭)
      const actualGenreMeta = allGenresMeta.find(g => g.name.toLowerCase() === parentGenreName.toLowerCase());
      const actualGenreId = actualGenreMeta ? actualGenreMeta.id : 'g1';

      // 1. 대장르 메타데이터 노드 추가
      nodes.push({
        id: actualGenreId,
        type: 'big_genre',
        name: parentGenreName,
        x: (Math.random() - 0.5) * 300,
        y: (Math.random() - 0.5) * 300
      });

      // 2. 하위 장르 노드 추가 (실제 하위 장르 ID 매핑)
      if (currentNode.subGenre) {
        let actualSubGenreId = 'sg1';
        const subNameLower = currentNode.subGenre.toLowerCase();
        for (const [_, parentGenre] of cachedGenres.entries()) {
          if (parentGenre.sub_genres_data) {
            const sub = parentGenre.sub_genres_data.find(s => s.name.toLowerCase() === subNameLower);
            if (sub) {
              actualSubGenreId = sub.id;
              break;
            }
          }
        }

        nodes.push({
          id: actualSubGenreId,
          type: 'sub_genre',
          name: currentNode.subGenre,
          x: (Math.random() - 0.5) * 300,
          y: (Math.random() - 0.5) * 300,
          parentGenre: parentGenreName
        });
      }


      // 4. 유사 곡 노드 추가 (Firestore에서 가져온 5곡 연동)
      if (currentNode.similarTracks && currentNode.similarTracks.length > 0) {
        currentNode.similarTracks.forEach((t) => {
          nodes.push({
            id: t.track_id,
            type: 'song',
            name: t.name,
            x: (Math.random() - 0.5) * 400,
            y: (Math.random() - 0.5) * 400,
            trackSnapshot: t,
            audioFeatures: t.features || { energy: t.energy, danceability: t.danceability, valence: t.valence },
            parentGenre: parentGenreName
          });
        });
      } else {
        nodes.push({
          id: 's-loading',
          type: 'song',
          name: 'Loading Similar Tracks...',
          x: (Math.random() - 0.5) * 300,
          y: (Math.random() - 0.5) * 300
        });
      }

      return nodes;
    }

    return [];
  }, [mode, currentNode, exploreTab, showSubGenres, allGenresMeta, cachedGenres, refreshKey]);

  const leftPanelProps = useMemo(() => {
    // 1. Root View (No Node selected or Home screen)
    if (!currentNode) {
      const items = allGenresMeta.slice(0, 30).map(pg => ({
        id: pg.id,
        name: pg.name,
        type: 'big_genre' as const,
        audioFeatures: pg.average_audio_features,
        rawObject: { id: pg.id, type: 'big_genre', name: pg.name, audioFeatures: pg.average_audio_features }
      }));
      return {
        type: 'root' as const,
        title: '대분류 장르 선택',
        subtitle: '총 30개 장르를 탐험하고 오디오 육각형을 디깅하세요',
        items,
        onItemClick: handleNodeClick,
        showTabSwitcher: false,
        showSubGenreToggle: true
      };
    }



    // 3. Parent Genre Selected View
    if (currentNode.type === 'big_genre') {
      const parentData = cachedGenres.get(currentNode.id);
      if (exploreTab === 'genre') {
        const items = (parentData?.sub_genres_data || []).map(sg => ({
          id: sg.id,
          name: sg.name,
          type: 'sub_genre' as const,
          audioFeatures: sg.average_audio_features,
          rawObject: {
            id: sg.id, type: 'sub_genre', name: sg.name, parentGenre: currentNode.name,
            audioFeatures: sg.average_audio_features
          }
        }));
        return {
          type: 'genre' as const,
          title: `${currentNode.name} 장르`,
          subtitle: '하위 장르들을 클릭하여 탐사 대상을 좁히세요',
          items,
          onItemClick: handleNodeClick,
          showTabSwitcher: true,
          showSubGenreToggle: false
        };
      } else {
        const songNodes = displayNodes.filter(n => n.type === 'song');
        const items = songNodes.map(n => ({
          id: n.id,
          name: n.name,
          type: 'song' as const,
          audioFeatures: n.audioFeatures,
          artists: n.trackSnapshot?.artists || '',
          albumCover: n.trackSnapshot?.album_cover || n.trackSnapshot?.album_art || '',
          rawObject: n
        }));
        return {
          type: 'genre' as const,
          title: `${currentNode.name} 수록곡`,
          subtitle: '인기곡을 장르 탐험선에 탑재하여 오디오 신호를 수신하세요',
          items,
          onItemClick: handleNodeClick,
          showTabSwitcher: true,
          showSubGenreToggle: false
        };
      }
    }

    // 4. Sub Genre Selected View
    if (currentNode.type === 'sub_genre') {
      const songNodes = displayNodes.filter(n => n.type === 'song');
      const items = songNodes.map(n => ({
        id: n.id,
        name: n.name,
        type: 'song' as const,
        audioFeatures: n.audioFeatures,
        artists: n.trackSnapshot?.artists || '',
        albumCover: n.trackSnapshot?.album_cover || n.trackSnapshot?.album_art || '',
        rawObject: n
      }));
      return {
        type: 'genre' as const,
        title: `${currentNode.name} 하위 장르`,
        subtitle: '하위 장르 소속 수록곡 신호 목록',
        items,
        onItemClick: handleNodeClick,
        showTabSwitcher: false,
        showSubGenreToggle: false
      };
    }

    // 5. Track Detail selected
    if (currentNode.type === 'song') {
      const similar = (currentNode.similarTracks || []).map(t => ({
        id: t.track_id,
        name: t.name,
        type: 'song' as const,
        audioFeatures: t.features || { energy: t.energy, danceability: t.danceability, valence: t.valence } as any,
        artists: t.artists,
        albumCover: t.album_cover,
        rawObject: {
          id: t.track_id, type: 'song', name: t.name,
          trackSnapshot: t, audioFeatures: t.features || { energy: t.energy, danceability: t.danceability, valence: t.valence },
          parentGenre: currentNode.parentGenre
        }
      }));
      return {
        type: 'track' as const,
        title: currentNode.trackSnapshot?.name || currentNode.name,
        subtitle: currentNode.trackSnapshot?.artists ? parseArtists(currentNode.trackSnapshot.artists) : '',
        items: similar,
        onItemClick: handleNodeClick,
        trackInfo: currentNode.trackSnapshot,
        isSpotifyLoggedIn: spotifyLoggedIn,
        isLiked: isTrackLiked,
        onLike: handleLikeTrack,
        onAddToPlaylist: handleAddToPlaylist,
        showTabSwitcher: false,
        showSubGenreToggle: false
      };
    }

    return {
      type: 'root' as const,
      title: '디깅 레이더 장르 목록',
      items: [],
      showTabSwitcher: false,
      showSubGenreToggle: false
    };
  }, [currentNode, allGenresMeta, cachedGenres, exploreTab, refreshKey, displayNodes, spotifyLoggedIn, isTrackLiked]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center font-sans">
        <div className="text-xl animate-pulse text-white/50 tracking-widest uppercase">Loading Universe...</div>
      </div>
    );
  }

  return (
    <>
      <CockpitFrame
        isLightHull={isLightHull}
        getHullStyle={getHullStyle}
        headerSlot={
          <>
            <div className="flex items-center gap-10">
              <h1 className="text-xl font-serif tracking-widest cursor-pointer" onClick={resetToHome}>DBDIGGING</h1>
              <div className="flex items-center gap-2 text-sm text-white/50 font-mono">
                {mode !== 'home' && (
                  <>
                    <button onClick={resetToHome} className="hover:text-white transition-colors uppercase">시작</button>
                    <span>&gt;</span>
                    <button onClick={() => { setCurrentNode(null); setDeepTracks([]); }} className="hover:text-white transition-colors uppercase">
                      {mode === 'explore' ? '탐색' : mode}
                    </button>
                  </>
                )}
                {currentNode && currentNode.type !== 'spaceship' && (
                  <>
                    {currentNode.parentGenre && currentNode.type !== 'big_genre' && (
                      <>
                        <span>&gt;</span>
                        <button
                          onClick={() => handleRestoreParentNode(currentNode.parentGenre)}
                          className="hover:text-white transition-colors uppercase"
                        >
                          {currentNode.parentGenre}
                        </button>
                      </>
                    )}
                    <span>&gt;</span>
                    <span className="text-white uppercase">{currentNode.name}</span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-6">
              {/* Sleek cybernetic 테마 PATTERN & COLOR control console */}
              <div className="flex items-center gap-4 bg-black/40 border border-white/10 rounded-full px-3 py-1.5 backdrop-blur-md">
                {/* 테마 PATTERN selector */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono tracking-wider text-white/55">테마:</span>
                  <div className="flex bg-black/60 rounded-full p-0.5 border border-white/5">
                    {(['default', 'pattern_b', 'pattern_c'] as const).map((p) => (
                      <button
                        key={p}
                        onClick={() => handlePatternChange(p)}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-mono transition-all duration-300 ${
                          patternTheme === p 
                            ? 'bg-[#B026FF] text-white shadow-[0_0_10px_rgba(176,38,255,0.5)] font-bold' 
                            : 'text-white/40 hover:text-white'
                        }`}
                      >
                        {p === 'default' ? '패턴A' : p === 'pattern_b' ? '패턴B' : '패턴C'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="h-3 w-[1px] bg-white/10" />

                {/* COLOR selector */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono tracking-wider text-white/55">색상:</span>
                  <div className="flex gap-1.5 items-center">
                    {(['original', 'cyan', 'purple', 'amber', 'green'] as const).map((theme) => {
                      const themeColors: Record<string, string> = {
                        original: 'bg-zinc-500 border-zinc-400',
                        cyan: 'bg-[#00FFFF] border-[#00E5E5]',
                        purple: 'bg-[#B026FF] border-[#9900FF]',
                        amber: 'bg-[#FF8C00] border-[#E57C00]',
                        green: 'bg-[#00FF66] border-[#00E55C]',
                      };
                      return (
                        <button
                          key={theme}
                          onClick={() => handleThemeModeChange(theme)}
                          className={`w-3.5 h-3.5 rounded-full border transition-all duration-300 hover:scale-125 ${themeColors[theme]} ${
                            hullThemeMode === theme 
                              ? 'scale-110 ring-2 ring-white/50 shadow-[0_0_8px_rgba(255,255,255,0.4)]' 
                              : 'opacity-60'
                          }`}
                          title={theme}
                        />
                      );
                    })}
                    
                    {/* Custom color picker */}
                    <div className="relative flex items-center">
                      <input 
                        type="color" 
                        onChange={(e) => handleCustomColorChange(e.target.value)}
                        className="absolute inset-0 opacity-0 w-3.5 h-3.5 cursor-pointer z-10"
                        title="Custom Color"
                      />
                      <div className={`w-3.5 h-3.5 rounded-full bg-gradient-to-tr from-rose-500 via-yellow-500 to-indigo-500 border border-white/20 hover:scale-125 transition-all ${
                        hullThemeMode === 'custom' 
                          ? 'scale-110 ring-2 ring-white/50' 
                          : 'opacity-60'
                      }`} />
                    </div>
                  </div>
                </div>
              </div>

              <div ref={searchRef} className="relative hidden md:flex items-center">
                <div className="absolute left-4 text-white/50"><SearchIcon /></div>
                <input
                  type="text"
                  placeholder="Search genre or track..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
                  onFocus={() => setSearchOpen(true)}
                  className="bg-[#1A1A1A] text-white placeholder-white/40 text-sm rounded-full pl-11 pr-4 py-2 outline-none focus:bg-[#252525] transition-all w-[240px] border border-white/5"
                />
                {searchOpen && searchQuery.trim() && (
                  <SearchDropdown
                    query={searchQuery}
                    genres={allGenresMeta}
                    cachedGenres={cachedGenres}
                    onSelectGenre={handleSearchSelectGenre}
                    onSelectTrack={handleSearchSelectTrack}
                    onClose={() => setSearchOpen(false)}
                  />
                )}
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={handleSpotifyLogin}
                  className="text-xs font-medium rounded-full px-4 py-2 flex items-center gap-2 transition-colors bg-[#1DB954] text-black hover:bg-[#1ed760]"
                >
                  <SpotifyIcon /> {spotifyLoggedIn ? `Connected${spotifyProfile?.display_name ? ` (${spotifyProfile.display_name})` : ' ✓'}` : 'Connect to Spotify'}
                </button>
              </div>
            </div>
          </>
        }
        leftPanelSlot={
          mode === 'home' ? (
            <GlassPanel className="w-full h-full text-white z-20 shadow-2xl flex flex-col justify-start overflow-hidden p-4">
              <div className="text-[10px] text-[#00FFFF] mb-1.5 font-mono tracking-widest uppercase">COCKPIT PLAYLIST</div>
              <h2 className="text-xl font-bold mb-0.5 truncate leading-tight">Trending Playlist</h2>
              <div className="text-xs text-white/40 mb-4 truncate">인기 곡 - 대한민국 (Top Songs)</div>
              <div className="flex-1 w-full rounded-2xl overflow-hidden border border-[#00FFFF]/20 bg-black/60 shadow-[inset_0_0_15px_rgba(0,0,0,0.8)] relative">
                <iframe 
                  data-testid="embed-iframe" 
                  style={{ borderRadius: '16px', border: 'none' }} 
                  src={`https://open.spotify.com/embed/playlist/${extractPlaylistId(import.meta.env.VITE_SPOTIFY_PLAYLIST_URL)}?utm_source=generator`}
                  width="100%" 
                  height="100%" 
                  allowFullScreen={true} 
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" 
                  loading="lazy"
                />
              </div>
            </GlassPanel>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div 
                key={currentNode?.id || 'root'} 
                initial={{ opacity: 0, x: -20 }} 
                animate={{ opacity: 1, x: 0 }} 
                exit={{ opacity: 0, x: -20 }} 
                className="h-full w-full"
              >
                <LeftPanel
                  type={leftPanelProps.type}
                  title={leftPanelProps.title}
                  subtitle={leftPanelProps.subtitle}
                  items={leftPanelProps.items}
                  onItemClick={leftPanelProps.onItemClick}
                  trackInfo={leftPanelProps.trackInfo}
                  isSpotifyLoggedIn={leftPanelProps.isSpotifyLoggedIn}
                  isLiked={leftPanelProps.isLiked}
                  onLike={leftPanelProps.onLike}
                  onAddToPlaylist={leftPanelProps.onAddToPlaylist}
                  exploreTab={mode === 'explore' ? exploreTab : undefined}
                  setExploreTab={setExploreTab}
                  showSubGenres={showSubGenres}
                  onToggleSubGenres={handleToggleSubGenres}
                  isExploreDeep={mode === 'explore' && currentNode !== null}
                  isLoadingSubGenres={isLoadingSubGenres}
                  showTabSwitcher={leftPanelProps.showTabSwitcher}
                  showSubGenreToggle={leftPanelProps.showSubGenreToggle}
                />
              </motion.div>
            </AnimatePresence>
          )
        }
        centerSlot={
          <div 
            className="w-full h-full relative overflow-hidden flex items-center justify-center"
            style={{
              backgroundImage: `url(${spaceNebulaBg})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            {/* Optics Compensation Adjustment Layer (After Effects의 보정 레이어 모방) */}
            <div 
              className="absolute inset-0 w-full h-full overflow-hidden flex items-center justify-center pointer-events-none"
              style={{
                filter: fovScale !== 0 ? 'url(#optics-compensation-warp)' : 'none',
                willChange: fovScale !== 0 ? 'filter' : 'auto',
              }}
            >
              {/* Glassmorphic Background Blur Layer (Behind Constellation) */}
              <div 
                className="absolute inset-0 z-0 pointer-events-none transition-all duration-500"
                style={{
                  backgroundColor: mode === 'home' ? 'rgba(0, 0, 0, 0.25)' : 'rgba(0, 0, 0, 0.4)',
                  backdropFilter: mode === 'home' ? 'blur(2px)' : 'blur(12px)',
                  WebkitBackdropFilter: mode === 'home' ? 'blur(2px)' : 'blur(12px)',
                }}
              />

              {/* D3 Constellation Star Map wrapped in interactive z-indexed container with hyperdrive warp zoom/rotate vortex */}
              <div 
                className={`relative z-[5] w-full h-full flex items-center justify-center transition-all duration-[1600ms] ease-in-out pointer-events-auto ${mode === 'home' ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
                style={{
                  opacity: isTransitioning ? 0 : undefined,
                  transform: isTransitioning ? 'scale(2.4)' : 'scale(1)',
                  filter: isTransitioning ? 'blur(4px)' : 'blur(0px)',
                }}
              >
                <Constellation
                  nodes={displayNodes}
                  centerNode={currentNode || undefined}
                  onNodeClick={handleNodeClick}
                  activeNodeId={currentNode?.id}
                  onPositionsSettled={handlePositionsSettled}
                  showSubGenres={showSubGenres}
                />
              </div>

              {/* 웰컴/홈 오버레이 뷰 (mode === 'home') with hyperdrive zoom out transition */}
              {mode === 'home' && (
                <div 
                  className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/15 transition-all duration-[800ms] ease-in pointer-events-auto"
                  style={{
                    opacity: isTransitioning ? 0 : 1,
                    transform: isTransitioning ? 'scale(1.25) translateY(20px)' : 'scale(1) translateY(0px)',
                    filter: isTransitioning ? 'blur(3px)' : 'blur(0px)',
                  }}
                >
                  <div className="text-center pointer-events-auto max-w-xl px-6 flex flex-col items-center gap-7 animate-fade-in">
                    <h2 className="text-3xl md:text-4xl font-extrabold leading-tight tracking-wide drop-shadow-[0_4px_16px_rgba(0,0,0,0.95)] text-white">
                      알고리즘을 벗어나,<br />당신만의 음악 우주를 탐험하세요.
                    </h2>
                    <button 
                      onClick={() => startExploreMode('genre')} 
                      className="px-10 py-4.5 rounded-full border-2 border-[#B026FF] bg-[#2A0845]/85 text-white font-bold text-base hover:bg-[#B026FF]/40 hover:shadow-[0_0_35px_rgba(176,38,255,0.85)] hover:scale-105 transition-all duration-300 backdrop-blur-md cursor-pointer"
                    >
                      장르별 음악 탐색 시작
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Cockpit Glass Window HUD Overlay (Always visible to maximize cockpit UI consistency) */}
            <div 
              className="absolute inset-0 z-10 pointer-events-none border border-[#00FFFF]/20 rounded-[24px] overflow-hidden shadow-[inset_0_0_80px_rgba(0,0,0,0.85)]"
            >
              {/* Glass shine diagonal line */}
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.035] to-transparent" />
              
              {/* HUD Corner Reticles / Grid Guide Lines */}
              <div className="absolute inset-4 border border-[#00FFFF]/10 rounded-[16px]">
                {/* Corner brackets */}
                <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-[#00FFFF]/25 rounded-tl" />
                <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-[#00FFFF]/25 rounded-tr" />
                <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-[#00FFFF]/25 rounded-bl" />
                <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-[#00FFFF]/25 rounded-br" />

                {/* Cockpit HUD indicators */}
                <div className="absolute top-6 left-8 font-mono text-[9px] text-[#00FFFF]/55 tracking-wider leading-relaxed">
                  SYS: {mode === 'home' ? 'STANDBY' : 'ACTIVE'}<br />
                  NAV: {mode === 'home' ? 'INITIALIZING' : 'CONSTELLATION_MAP'}
                </div>
                <div className="absolute top-6 right-8 font-mono text-[9px] text-[#00FFFF]/55 tracking-wider text-right leading-relaxed">
                  RADAR: 360° SENSING<br />
                  SIG: {spotifyLoggedIn ? 'CONNECTED' : 'STANDBY'}
                </div>
                <div className="absolute bottom-6 left-8 font-mono text-[9px] text-[#B026FF]/55 tracking-wider leading-relaxed">
                  DEEP DIVE: {mode === 'home' ? 'STANDBY' : 'READY'}<br />
                  HULL: 100%
                </div>
                <div className="absolute bottom-6 right-8 font-mono text-[9px] text-[#B026FF]/55 tracking-wider text-right leading-relaxed">
                  AUTO-DECODE: ON<br />
                  COCKPIT MODE
                </div>
              </div>
            </div>

            {/* Immersive Local Space Hyperdrive Warp Transition Overlay (Cockpit Glass Internal Vortex) */}
            <AnimatePresence>
              {isTransitioning && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ 
                    opacity: [0, 1, 1, 0],
                  }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.8, ease: "easeInOut" }}
                  className="absolute inset-0 z-[12] bg-[#050505]/20 pointer-events-none flex items-center justify-center overflow-hidden"
                >
                  {/* Warp Core Ring 1 */}
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ 
                      scale: [0.8, 2.2, 3.8],
                      opacity: [0, 0.85, 0] 
                    }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    className="absolute w-[80%] h-[80%] rounded-full border-2 border-[#00FFFF]/35 flex items-center justify-center shadow-[0_0_60px_rgba(0,255,255,0.4)]"
                  >
                    <div className="w-[85%] h-[85%] rounded-full border border-dashed border-[#B026FF]/25" />
                  </motion.div>

                  {/* Warp Core Ring 2 */}
                  <motion.div
                    initial={{ scale: 0.4, opacity: 0 }}
                    animate={{ 
                      scale: [0.4, 1.6, 2.8],
                      opacity: [0, 0.7, 0] 
                    }}
                    transition={{ duration: 1.6, delay: 0.12, ease: "easeOut" }}
                    className="absolute w-[80%] h-[80%] rounded-full border border-[#B026FF]/45 flex items-center justify-center shadow-[0_0_40px_rgba(176,38,255,0.35)]"
                  >
                    <div className="w-[90%] h-[90%] rounded-full border border-dashed border-[#00FFFF]/15" />
                  </motion.div>

                  {/* Center hyper speed flash */}
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.1 }}
                    animate={{ 
                      opacity: [0, 0.9, 0],
                      scale: [0.1, 2.2, 4.0]
                    }}
                    transition={{ duration: 1.4, delay: 0.08 }}
                    className="absolute w-36 h-36 rounded-full bg-gradient-to-r from-[#00FFFF]/50 to-[#B026FF]/50 filter blur-[20px]"
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        }
        rightPanelSlot={
          <>
            {/* Top: Right Panel (Radar Chart) */}
            <div className="flex-1 min-h-0 flex flex-col justify-start">
              <AnimatePresence mode="wait">
                <motion.div 
                  key={currentNode?.id || 'root'} 
                  initial={{ opacity: 0, x: 20 }} 
                  animate={{ opacity: 1, x: 0 }} 
                  exit={{ opacity: 0, x: 20 }} 
                  className="h-full w-full"
                >
                  {mode === 'home' ? (
                    <GlassPanel className="w-full h-full text-white flex flex-col items-center justify-center border border-white/10 p-6 min-h-[220px]">
                      <div className="flex flex-col items-center text-center gap-3.5">
                        <div className="w-12 h-12 rounded-full border border-dashed border-[#B026FF]/40 flex items-center justify-center animate-spin" style={{ animationDuration: '10s' }}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#B026FF] animate-pulse">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 6v6l4 2" />
                          </svg>
                        </div>
                        <span className="text-[12px] font-bold text-[#B026FF]/80 font-mono uppercase tracking-widest">COCKPIT READY</span>
                        <span className="text-[11px] text-white/40 leading-relaxed font-sans">
                          탐색선 분석 모듈 예열 완료.<br />음악 탐색을 가동하시면<br />실시간 레이더 오차 보정이 시작됩니다.
                        </span>
                      </div>
                    </GlassPanel>
                  ) : currentNode && currentNode.type === 'big_genre' && currentNode.audioFeatures ? (
                    <RightPanel 
                      title={`${currentNode.name} 특성`} 
                      subtitle="장르 평균 분석" 
                      features={currentNode.audioFeatures} 
                      featuresLabel="장르"
                    />
                  ) : currentNode && currentNode.type === 'sub_genre' && currentNode.audioFeatures ? (
                    <RightPanel 
                      title={`${currentNode.name} 특성`} 
                      subtitle="장르 평균 분석" 
                      features={allGenresMeta.find(g => g.name === currentNode.parentGenre)?.average_audio_features || {}}
                      compareFeatures={currentNode.audioFeatures}
                      featuresLabel="장르"
                      compareFeaturesLabel="하위 장르"
                    />
                  ) : currentNode && currentNode.type === 'song' && currentNode.audioFeatures ? (
                    <RightPanel title="곡 오디오 분석" subtitle={currentNode.trackSnapshot!.name}
                      features={getParentGenreFeatures(currentNode.parentGenre) || {}}
                      compareFeatures={currentNode.audioFeatures}
                      featuresLabel={isSubGenre(currentNode.parentGenre) ? '하위 장르' : '장르'}
                      compareFeaturesLabel="노래"
                    />
                  ) : (
                    <GlassPanel className="w-full h-full text-white flex flex-col items-center justify-center border border-white/10 p-6 min-h-[220px]">
                      <div className="flex flex-col items-center text-center gap-3">
                        <div className="w-12 h-12 rounded-full border border-dashed border-[#00FFFF]/40 flex items-center justify-center animate-spin" style={{ animationDuration: '6s' }}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#00FFFF]">
                            <path d="M12 2v20M2 12h20" />
                            <circle cx="12" cy="12" r="10" />
                          </svg>
                        </div>
                        <span className="text-[13px] font-bold text-[#00FFFF]/80 font-mono uppercase tracking-widest">RADAR SIGNAL WAITING</span>
                        <span className="text-[11px] text-white/40 leading-relaxed font-sans">
                          분석할 장르 또는 곡 노드를 클릭하여<br />오디오 육각형 시그널을 확인하세요.
                        </span>
                      </div>
                    </GlassPanel>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Bottom: DBDIGGING LOG */}
            <GlassPanel className="w-full h-[25vh] min-h-[160px] text-white">
              <div className="flex-1 min-h-0 w-full p-2 flex flex-col">
                <div className="text-[10px] text-[#00FFFF] mb-1 font-mono tracking-widest uppercase">DBDIGGING LOG</div>
                <div className="flex-1 min-h-0 overflow-hidden relative">
                  <Minimap />
                </div>
              </div>
            </GlassPanel>
          </>
        }
        footerSlot={
          <div className="w-full h-full flex items-center justify-center font-mono text-[10px] text-white/35 tracking-wider select-none">
            🌌 DBDIGGING COCKPIT CONSOLE // STELLAR NAVIGATOR v1.4 // SYSTEM STABLE
          </div>
        }
      />

      {/* Playlist Modal */}
      {showPlaylistModal && playlistTargetTrack && (
        <PlaylistModal
          trackId={playlistTargetTrack.id}
          trackName={playlistTargetTrack.name}
          spotifyLoggedIn={spotifyLoggedIn}
          showToast={showToast}
          onClose={() => { setShowPlaylistModal(false); setPlaylistTargetTrack(null); }}
        />
      )}

      {/* Premium Toast Notification Popups */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3.5 rounded-full border backdrop-blur-md shadow-[0_4px_30px_rgba(0,0,0,0.5)] flex items-center gap-3 transition-all duration-300 ${
              toastType === 'success'
                ? 'bg-emerald-950/80 border-emerald-500/30 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                : toastType === 'error'
                ? 'bg-rose-950/80 border-rose-500/30 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.2)]'
                : 'bg-indigo-950/80 border-indigo-500/30 text-indigo-300 shadow-[0_0_15px_rgba(99,102,241,0.2)]'
            }`}
          >
            {toastType === 'success' && (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 animate-bounce text-emerald-400">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            )}
            {toastType === 'error' && (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 animate-pulse text-rose-400">
                <circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            )}
            {toastType === 'info' && (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 animate-pulse text-indigo-400">
                <circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>
            )}
            <span className="text-xs font-medium tracking-wide">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AE Optics Compensation (광학 구면 왜곡) 하드웨어 가속 SVG displacementMap 필터 */}
      <svg xmlns="http://www.w3.org/2000/svg" className="hidden w-0 h-0 absolute pointer-events-none">
        <defs>
          <filter id="optics-compensation-warp" x="-20%" y="-20%" width="140%" height="140%">
            <feImage 
              href="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='800' viewBox='0 0 800 800'><radialGradient id='rg' cx='50%' cy='50%' r='50%'><stop offset='0%' stop-color='%237f7f00'/><stop offset='100%' stop-color='%23ff0000'/></radialGradient><rect width='800' height='800' fill='url(%23rg)'/></svg>"
              result="distortionMap"
              x="0%" y="0%" width="100%" height="100%"
              preserveAspectRatio="none"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="distortionMap"
              scale={fovScale}
              xChannelSelector="R"
              yChannelSelector="G"
              result="warped"
            />
          </filter>
        </defs>
      </svg>
    </>
  );
}

export default function App() {
  const [showOrientationGuide, setShowOrientationGuide] = useState(false);

  useEffect(() => {
    const handleCheck = () => {
      // 1. 기기 타입 판별 (데스크탑 PC 환경 방어)
      const ua = navigator.userAgent || navigator.vendor || (window as any).opera;
      const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua.toLowerCase());
      const hasTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
      
      // 데스크탑 PC인 경우(터치가 없고 모바일 UA가 아님) 절대 회전 가이드를 띄우지 않음
      const isMobileDevice = isMobileUA || hasTouch;
      if (!isMobileDevice) {
        setShowOrientationGuide(false);
        return;
      }
      
      // 2. 모바일/태블릿 화면 크기(가로 1024px 이하) 및 세로 모드(Portrait) 여부 감지
      const isPortrait = window.innerHeight > window.innerWidth;
      const isSmallScreen = window.innerWidth <= 1024;

      setShowOrientationGuide(isPortrait && isSmallScreen);
    };

    handleCheck();
    window.addEventListener('resize', handleCheck);
    window.addEventListener('orientationchange', handleCheck);
    return () => {
      window.removeEventListener('resize', handleCheck);
      window.removeEventListener('orientationchange', handleCheck);
    };
  }, []);

  return (
    <>
      <AnimatePresence mode="wait">
        {showOrientationGuide && (
          <motion.div
            key="landscape-guide"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[9999]"
          >
            <LandscapeGuide />
          </motion.div>
        )}
      </AnimatePresence>
      <DiggingProvider>
        <MainApp />
      </DiggingProvider>
    </>
  );
}
