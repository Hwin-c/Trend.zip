import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Constellation } from './components/Constellation';
import { Minimap } from './components/Minimap';
import { DiggingProvider, useDigging } from './DiggingContext';
import { NodeData, ParentGenre, SubGenre, TrackSnapshot } from './types';
import { motion, AnimatePresence } from 'motion/react';
import {
  fetchHomeTrending, fetchAllGenresMetadata, fetchParentGenreById, fetchAllParentGenres,
  fetchTracksByGenre,
} from './lib/firebase';
import { LeftPanel } from './components/LeftPanel';
import { RightPanel } from './components/RightPanel';
import { TunedExplorePanel } from './components/TunedExplorePanel';
import { SearchDropdown } from './components/SearchDropdown';
import { PlaylistModal } from './components/PlaylistModal';
import { loginWithSpotify, handleSpotifyCallback, isLoggedIn, logout, getSpotifyProfile } from './lib/spotifyAuth';
import { fetchTrackFromSpotify, saveTrack, removeSavedTrack, checkSavedTrack } from './lib/spotify';
import { parseArtists } from './lib/utils';

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
  const [mode, setMode] = useState<'home' | 'explore' | 'tuned'>('home');
  const [exploreTab, setExploreTab] = useState<'genre' | 'song'>('genre');
  const [showSubGenres, setShowSubGenres] = useState<boolean>(false);
  const [currentNode, setCurrentNode] = useState<NodeData | null>(null);
  const { addToLog, clearLog } = useDigging();

  const [homeTrending, setHomeTrending] = useState<TrackSnapshot[]>([]);
  const [allGenresMeta, setAllGenresMeta] = useState<Pick<ParentGenre, 'id' | 'name' | 'average_audio_features'>[]>([]);
  const [cachedGenres, setCachedGenres] = useState<Map<string, ParentGenre>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const [isLoadingSubGenres, setIsLoadingSubGenres] = useState(false);

  // Position cache for smooth sub-genre toggle (no re-layout of existing nodes)
  const [nodePositionCache, setNodePositionCache] = useState<Map<string, { x: number; y: number }>>(new Map());

  const handlePositionsSettled = useCallback((positions: Map<string, { x: number; y: number }>) => {
    setNodePositionCache(positions);
  }, []);

  // Deep Dive Pagination State
  const [deepTracks, setDeepTracks] = useState<TrackSnapshot[]>([]);
  const [isDeepDiving, setIsDeepDiving] = useState(false);
  const [tunedTracks, setTunedTracks] = useState<TrackSnapshot[]>([]);

  // Spotify Auth State
  const [spotifyLoggedIn, setSpotifyLoggedIn] = useState(isLoggedIn());
  const [spotifyProfile, setSpotifyProfile] = useState<{ display_name: string; images: { url: string }[] } | null>(null);
  const [isTrackLiked, setIsTrackLiked] = useState(false);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [playlistTargetTrack, setPlaylistTargetTrack] = useState<{ id: string; name: string } | null>(null);

  // Handle Spotify OAuth callback on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('code')) {
      handleSpotifyCallback().then(token => {
        if (token) {
          setSpotifyLoggedIn(true);
          getSpotifyProfile().then(p => setSpotifyProfile(p));
        }
      });
    } else if (isLoggedIn()) {
      getSpotifyProfile().then(p => setSpotifyProfile(p));
    }
  }, []);

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
      logout();
      setSpotifyLoggedIn(false);
      setSpotifyProfile(null);
    } else {
      loginWithSpotify();
    }
  };

  const handleLikeTrack = async () => {
    if (!currentNode?.trackSnapshot) return;
    const trackId = currentNode.trackSnapshot.track_id;
    if (isTrackLiked) {
      const success = await removeSavedTrack(trackId);
      if (success) setIsTrackLiked(false);
    } else {
      const success = await saveTrack(trackId);
      if (success) setIsTrackLiked(true);
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
    setCurrentNode({
      id: track.track_id, type: 'song', name: track.name,
      x: 50, y: 50,
      trackSnapshot: track, audioFeatures: track.features, parentGenre: parentGenreName
    });
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
    addToLog(node.id, node.name, node.type);
    if (mode === 'home') return;

    // Clear deep tracks on navigation
    setDeepTracks([]);

    // Extreme Denormalization: Fetch Full ParentGenre only once
    if (node.type === 'big_genre') {
      if (!cachedGenres.has(node.id)) {
        const fullGenre = await fetchParentGenreById(node.id);
        if (fullGenre) {
          setCachedGenres(prev => new Map(prev).set(node.id, fullGenre));
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
        energy: t.audio_features?.energy,
        danceability: t.audio_features?.danceability,
        valence: t.audio_features?.valence,
        features: t.audio_features,
      }));
      node = { ...node, topTracks: mapped };
    }

    // Fetch album art from Spotify for song nodes
    if (node.type === 'song' && node.trackSnapshot && !node.trackSnapshot.album_cover) {
      fetchTrackFromSpotify(node.trackSnapshot.track_id).then(info => {
        if (info?.album_art) {
          setCurrentNode(prev => {
            if (!prev || prev.id !== node.id) return prev;
            return {
              ...prev,
              trackSnapshot: { ...prev.trackSnapshot!, album_cover: info.album_art },
            };
          });
        }
      });
    }

    setCurrentNode(node);
  };

  const startExploreMode = (tab: 'genre' | 'song', targetMode: 'explore' | 'tuned' = 'explore') => {
    setMode(targetMode);
    setExploreTab(tab);
    setCurrentNode(null);
    setDeepTracks([]);
  };

  const handleDeepDive = async () => {
    if (!currentNode) return;
    setIsDeepDiving(true);
    const newTracks = await fetchTracksByGenre(currentNode.name, 20);
    const mappedTracks: TrackSnapshot[] = newTracks.map(t => ({
      track_id: t.track_id,
      name: t.name,
      artists: t.artists,
      energy: t.audio_features?.energy,
      danceability: t.audio_features?.danceability,
      valence: t.audio_features?.valence,
      features: t.audio_features
    }));
    setDeepTracks(prev => [...prev, ...mappedTracks]);
    setIsDeepDiving(false);
  };

  const handleTunedExplore = (features: any, genre: string) => {
    // Sort homeTrending (or any fetched tracks) by distance to selected features
    const calculateDistance = (t: TrackSnapshot) => {
      const tf = t.features || { energy: t.energy, danceability: t.danceability };
      if (!tf) return 999;
      const dx = (tf.energy || 0) - (features.energy || 0);
      const dy = (tf.danceability || 0) - (features.danceability || 0);
      const dz = (tf.valence || 0) - (features.valence || 0);
      return Math.sqrt(dx * dx + dy * dy + dz * dz);
    };

    // Sort and pick top 5
    const matched = [...homeTrending].sort((a, b) => calculateDistance(a) - calculateDistance(b)).slice(0, 5);
    setTunedTracks(matched);
    setCurrentNode({ id: 'spaceship', type: 'spaceship', name: 'Spaceship', x: 50, y: 50 });
  };

  // Node Calculation Logic
  const displayNodes = useMemo(() => {
    if (mode === 'home') return [];

    if (mode === 'tuned' && currentNode?.type === 'spaceship') {
      // Show matched tracks around spaceship
      return tunedTracks.map((t, i) => {
        const angle = (i / tunedTracks.length) * Math.PI * 2;
        return {
          id: t.track_id, type: 'song', name: t.name,
          x: 50 + Math.random() * 10, y: 50 + Math.random() * 10,
          trackSnapshot: t, audioFeatures: t.features, parentGenre: 'Tuned'
        };
      }) as NodeData[];
    }

    if (mode === 'tuned' && !currentNode) {
      return []; // Do not show genre constellations on initial tuned screen
    }

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
          const parentNode: NodeData = {
            id: 'parent_genre_node', type: 'big_genre', name: currentNode.parentGenre || 'Parent Genre',
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
      return [
        { id: currentNode.id, type: 'song', name: currentNode.name, x: 0, y: 0 },
        { id: 'g1', type: 'big_genre', name: currentNode.parentGenre || 'Genre', x: Math.random()*600 - 300, y: Math.random()*600 - 300 },
        { id: 'a1', type: 'artist', name: currentNode.trackSnapshot?.artists || 'Artist', x: Math.random()*600 - 300, y: Math.random()*600 - 300 },
        { id: 'al1', type: 'album', name: 'Album', x: Math.random()*600 - 300, y: Math.random()*600 - 300 },
        { id: 's1', type: 'song', name: 'Similar Track 1', x: Math.random()*600 - 300, y: Math.random()*600 - 300 },
        { id: 's2', type: 'song', name: 'Similar Track 2', x: Math.random()*600 - 300, y: Math.random()*600 - 300 },
      ] as NodeData[];
    }

    return [];
  }, [mode, currentNode, exploreTab, showSubGenres, allGenresMeta, cachedGenres, refreshKey]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center font-sans">
        <div className="text-xl animate-pulse text-white/50 tracking-widest uppercase">Loading Universe...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white overflow-hidden font-sans selection:bg-[#B026FF]/30">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_#151030_0%,_#050510_100%)] opacity-100" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-40 mix-blend-screen" />
      </div>

      {/* Header */}
      <header className="relative z-30 flex items-center justify-between px-8 py-6 bg-transparent">
        <div className="flex items-center gap-10">
          <h1 className="text-xl font-serif tracking-widest cursor-pointer" onClick={resetToHome}>DBDIGGING</h1>
          <div className="flex items-center gap-2 text-sm text-white/50 font-mono">
            {mode !== 'home' && (
              <>
                <button onClick={resetToHome} className="hover:text-white transition-colors uppercase">ROOT</button>
                <span>&gt;</span>
                <button onClick={() => { setCurrentNode(null); setDeepTracks([]); }} className="hover:text-white transition-colors uppercase">{mode}</button>
              </>
            )}
            {currentNode && currentNode.type !== 'spaceship' && (
              <>
                {currentNode.parentGenre && currentNode.type !== 'big_genre' && (
                  <>
                    <span>&gt;</span>
                    <button
                      onClick={() => {
                        const parent = allGenresMeta.find(g => g.name === currentNode.parentGenre);
                        if (parent) {
                          setCurrentNode({ id: parent.id, type: 'big_genre', name: parent.name });
                        } else {
                          setCurrentNode(null);
                        }
                      }}
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
          <div ref={searchRef} className="relative hidden md:flex items-center">
            <div className="absolute left-4 text-white/50"><SearchIcon /></div>
            <input
              type="text"
              placeholder="Search genre or track..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
              onFocus={() => setSearchOpen(true)}
              className="bg-[#1A1A1A] text-white placeholder-white/40 text-sm rounded-full pl-11 pr-4 py-2.5 outline-none focus:bg-[#252525] transition-all w-[300px] border border-white/5"
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
              className={`text-sm font-medium rounded-full px-5 py-2.5 flex items-center gap-2 transition-colors ${spotifyLoggedIn
                  ? 'bg-[#1DB954] text-black hover:bg-[#1ed760]'
                  : 'bg-[#1DB954] text-black hover:bg-[#1ed760]'
                }`}
            >
              <SpotifyIcon /> {spotifyLoggedIn ? `Connected${spotifyProfile?.display_name ? ` (${spotifyProfile.display_name})` : ' ✓'}` : 'Connect to Spotify'}
            </button>
            <button className="text-white/50 hover:text-white w-9 h-9 rounded-full border border-white/20 flex items-center justify-center transition-colors">
              <UserIcon />
            </button>
          </div>
        </div>
      </header>

      {/* Top Controls (Explore Mode only) */}
      {mode === 'explore' && (
        <div className="absolute top-24 left-8 z-30 flex flex-col gap-4">
          {currentNode && (
            <div className="flex bg-[#111] border border-white/10 rounded-full overflow-hidden w-fit">
              <button onClick={() => setExploreTab('genre')} className={`px-6 py-2 text-sm font-medium transition-colors ${exploreTab === 'genre' ? 'bg-[#B026FF] text-white' : 'text-white/50 hover:text-white'}`}>[장르]</button>
              <button onClick={() => setExploreTab('song')} className={`px-6 py-2 text-sm font-medium transition-colors ${exploreTab === 'song' ? 'bg-[#B026FF] text-white' : 'text-white/50 hover:text-white'}`}>[노래]</button>
            </div>
          )}
          {!currentNode && (
            <button
              onClick={handleToggleSubGenres}
              disabled={isLoadingSubGenres}
              className={`w-fit px-6 py-2 text-sm font-medium rounded-full transition-colors border ${showSubGenres ? 'bg-[#B026FF] text-white border-[#B026FF]' : 'bg-[#111] text-white/50 border-white/10 hover:text-white'} ${isLoadingSubGenres ? 'opacity-50 cursor-wait' : ''}`}
            >
              {isLoadingSubGenres ? '데이터 불러오는 중...' : showSubGenres ? '[세부 장르 닫기]' : '[세부 장르 보기]'}
            </button>
          )}
          {exploreTab === 'song' && (currentNode?.type === 'big_genre' || currentNode?.type === 'sub_genre') && (
            <div className="flex flex-col gap-2">
              <button
                onClick={handleRefreshSongs}
                className="flex items-center justify-center gap-2 px-6 py-2 bg-[#10B981]/20 hover:bg-[#10B981]/40 border border-[#10B981]/50 text-[#10B981] text-sm font-medium rounded-full transition-all"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"></path><path d="M16 21v-5h5"></path></svg>
                노래 새로고침
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main Content Area */}
      <main className="relative w-full h-[calc(100vh-85px)] z-10 flex flex-col">
        {mode === 'home' ? (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-between py-12 pointer-events-none">
            <div className="text-center pointer-events-auto mt-20">
              <h2 className="text-4xl md:text-5xl font-bold leading-tight mb-12 drop-shadow-2xl">
                알고리즘을 벗어나,<br />당신만의 음악 우주를 탐험하세요.
              </h2>
              <div className="flex items-center justify-center gap-6">
                <button onClick={() => startExploreMode('genre')} className="px-8 py-4 rounded-[2rem] border border-[#B026FF] bg-[#2A0845]/60 text-white font-medium text-lg hover:bg-[#B026FF]/30 hover:shadow-[0_0_30px_rgba(176,38,255,0.6)] transition-all duration-300 backdrop-blur-sm">
                  [장르별 음악 탐색 시작하기]
                </button>
                <button onClick={() => startExploreMode('song', 'tuned')} className="px-8 py-4 rounded-[2rem] border border-[#10B981] bg-[#064E3B]/60 text-white font-medium text-lg hover:bg-[#10B981]/30 hover:shadow-[0_0_30px_rgba(16,185,129,0.6)] transition-all duration-300 backdrop-blur-sm">
                  [노래 기반 탐색 시작하기]
                </button>
              </div>
            </div>

            {/* Trending Section */}
            <div className="w-full px-12 pointer-events-auto">
              <div className="flex items-center gap-4 mb-4">
                <h3 className="text-xl font-bold">요즘 뜨는 장르 & 신곡 파도타기</h3>
                <div className="flex gap-2">
                  <span className="px-3 py-1 bg-white/10 rounded-full text-xs text-white/70">Trending</span>
                  <span className="px-3 py-1 bg-white/10 rounded-full text-xs text-white/70">K-Pop Rising</span>
                </div>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
                {homeTrending.map((track, i) => (
                  <div key={i} className="min-w-[200px] bg-[#1A1A1A] rounded-xl p-3 border border-white/5 flex flex-col">
                    <div className="text-xs text-white/50 mb-2 truncate">{parseArtists(track.artists)}</div>
                    <div className="w-full aspect-square bg-white/5 rounded-lg mb-3 overflow-hidden">
                      {track.album_cover && <img src={track.album_cover} alt={track.name} className="w-full h-full object-cover" />}
                    </div>
                    <div className="text-sm text-white mb-2 truncate font-bold">{track.name}</div>
                    <div className="flex items-center justify-between text-xs mb-1 text-white/70">
                      <span>⚡ Energy</span><span>{track.energy?.toFixed(2) || track.features?.energy?.toFixed(2) || 'N/A'}</span>
                    </div>
                    <div className="w-full bg-white/10 h-1.5 rounded-full mb-2">
                      <div className="bg-yellow-400 h-full rounded-full" style={{ width: `${(track.energy || track.features?.energy || 0) * 100}%` }} />
                    </div>
                    <div className="flex items-center justify-between text-xs mb-1 text-white/70">
                      <span>🕺 Dance</span><span>{track.danceability?.toFixed(2) || track.features?.danceability?.toFixed(2) || 'N/A'}</span>
                    </div>
                    <div className="w-full bg-white/10 h-1.5 rounded-full">
                      <div className="bg-purple-400 h-full rounded-full" style={{ width: `${(track.danceability || track.features?.danceability || 0) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="absolute inset-0">
              <Constellation
                nodes={displayNodes}
                centerNode={currentNode || undefined}
                onNodeClick={handleNodeClick}
                activeNodeId={currentNode?.id}
                onPositionsSettled={handlePositionsSettled}
              />
            </div>
            
            <AnimatePresence mode="wait">
              <motion.div key={currentNode?.id || 'root'} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0 pointer-events-auto">
                  {/* Panels */}
                  {(currentNode?.type === 'big_genre' || currentNode?.type === 'sub_genre') && (
                <>
                  <LeftPanel type="genre" title={`${currentNode.name} (${currentNode.type === 'big_genre' ? '대분류' : '세부 장르'})`}
                    keyArtists={(currentNode.type === 'big_genre' ? cachedGenres.get(currentNode.id)?.top_tracks : currentNode.topTracks)?.slice(0, 4).map(t => exploreTab === 'song' ? `"${t.name}" by ${parseArtists(t.artists)}` : parseArtists(t.artists))}
                  />
                  {currentNode.audioFeatures && (
                    <RightPanel title={`${currentNode.name} - Average Audio Features`} subtitle="Genre Avg" features={currentNode.audioFeatures} />
                  )}
                </>
              )}

              {currentNode?.type === 'song' && currentNode.trackSnapshot && (
                <>
                  <LeftPanel
                    type="track"
                    title={currentNode.trackSnapshot.name}
                    subtitle={currentNode.trackSnapshot.artists}
                    trackInfo={currentNode.trackSnapshot}
                    isSpotifyLoggedIn={spotifyLoggedIn}
                    isLiked={isTrackLiked}
                    onLike={handleLikeTrack}
                    onAddToPlaylist={handleAddToPlaylist}
                  />
                  {currentNode.audioFeatures && (
                    <RightPanel title="Selected Track Audio Features" subtitle={currentNode.trackSnapshot.name}
                      features={allGenresMeta.find(g => g.name === currentNode.parentGenre)?.average_audio_features || {}}
                      compareFeatures={currentNode.audioFeatures}
                    />
                  )}
                </>
              )}

                  {mode === 'tuned' && !currentNode && (
                    <TunedExplorePanel onExplore={(features) => {
                      setCurrentNode({ id: 'ship', type: 'spaceship', name: '', x: 50, y: 50 });
                    }} />
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </>
        )}
      </main>

      {/* Minimap Log */}
      {mode !== 'home' && (
        <div className="absolute bottom-4 right-4 z-30">
          <div className="bg-[#111]/90 backdrop-blur-md border border-white/10 p-3 rounded-xl shadow-2xl">
            <div className="text-[10px] text-white/50 mb-2 font-mono tracking-widest">DBDIGGING LOG</div>
            <Minimap />
          </div>
        </div>
      )}

      {/* Playlist Modal */}
      {showPlaylistModal && playlistTargetTrack && (
        <PlaylistModal
          trackId={playlistTargetTrack.id}
          trackName={playlistTargetTrack.name}
          onClose={() => { setShowPlaylistModal(false); setPlaylistTargetTrack(null); }}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <DiggingProvider>
      <MainApp />
    </DiggingProvider>
  );
}
