import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Constellation } from './components/Constellation';
import { Minimap } from './components/Minimap';
import { DiggingProvider, useDigging } from './DiggingContext';
import { NodeData, ParentGenre, SubGenre, TrackSnapshot } from './types';
import { motion, AnimatePresence } from 'motion/react';
import {
  db, fetchHomeTrending, fetchAllGenresMetadata, fetchParentGenreById, fetchAllParentGenres,
  fetchTracksByGenre,
} from './lib/firebase';
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { LeftPanel } from './components/LeftPanel';
import { RightPanel } from './components/RightPanel';
import { TunedExplorePanel } from './components/TunedExplorePanel';
import { SearchDropdown } from './components/SearchDropdown';
import { PlaylistModal } from './components/PlaylistModal';
import { loginWithSpotify, handleSpotifyCallback, isLoggedIn, logout, getSpotifyProfile } from './lib/spotifyAuth';
import { fetchTrackFromSpotify, saveTrack, removeSavedTrack, checkSavedTrack } from './lib/spotify';
import { parseArtists } from './lib/utils';
import { GlassPanel } from './components/GlassPanel';
import spaceshipTexture from './assets/spaceship_texture.webp';
import spaceNebulaBg from './assets/space_nebula_bg.webp';


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
      if (window.confirm('로그아웃하시겠습니까?')) {
        logout();
        setSpotifyLoggedIn(false);
        setSpotifyProfile(null);
      }
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
        album_cover: (t as any).album_cover || (t as any).album_art,
        energy: t.audio_features?.energy,
        danceability: t.audio_features?.danceability,
        valence: t.audio_features?.valence,
        features: t.audio_features,
      }));
      node = { ...node, topTracks: mapped };

      // Async visual cover restoration loop for sub_genre tracks
      mapped.forEach((track, index) => {
        if (!track.album_cover) {
          fetchTrackFromSpotify(track.track_id).then(info => {
            if (info?.album_art) {
              setCurrentNode(prev => {
                if (!prev || prev.id !== node.id || prev.type !== 'sub_genre') return prev;
                const updatedTracks = [...(prev.topTracks || [])];
                if (updatedTracks[index]) {
                  updatedTracks[index] = { ...updatedTracks[index], album_cover: info.album_art };
                }
                return { ...prev, topTracks: updatedTracks };
              });
            }
          });
        }
      });
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
              
            const updatedNode = { 
              ...node, 
              similarTracks: filtered,
              parentGenre: parentGenreName || node.parentGenre
            };
            
            setCurrentNode(updatedNode);
            
            // Async cover restoration loop for similar tracks
            filtered.forEach((track, index) => {
              if (!track.album_cover) {
                fetchTrackFromSpotify(track.track_id).then(info => {
                  if (info?.album_art) {
                    setCurrentNode(prev => {
                      if (!prev || prev.id !== node.id || prev.type !== 'song') return prev;
                      const updatedSimilar = [...(prev.similarTracks || [])];
                      if (updatedSimilar[index]) {
                        updatedSimilar[index] = { ...updatedSimilar[index], album_cover: info.album_art };
                      }
                      return { ...prev, similarTracks: updatedSimilar };
                    });
                  }
                });
              }
            });
          }
        } catch (error) {
          console.error("Error loading similar tracks from Firestore:", error);
        }
      })();
    }

    // Fetch album art from Spotify for song nodes (self)
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
      album_cover: (t as any).album_cover || (t as any).album_art,
      energy: t.audio_features?.energy,
      danceability: t.audio_features?.danceability,
      valence: t.audio_features?.valence,
      features: t.audio_features
    }));
    setDeepTracks(prev => [...prev, ...mappedTracks]);

    // Async restoration loop for deep tracks
    mappedTracks.forEach((track) => {
      if (!track.album_cover) {
        fetchTrackFromSpotify(track.track_id).then(info => {
          if (info?.album_art) {
            setDeepTracks(prev => {
              const updated = [...prev];
              const idx = updated.findIndex(u => u.track_id === track.track_id);
              if (idx !== -1) {
                updated[idx] = { ...updated[idx], album_cover: info.album_art };
              }
              return updated;
            });
          }
        });
      }
    });

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
      const nodes: NodeData[] = [
        { 
          id: currentNode.id, 
          type: 'song', 
          name: currentNode.name, 
          x: 0, 
          y: 0,
          trackSnapshot: currentNode.trackSnapshot,
          audioFeatures: currentNode.audioFeatures
        }
      ];

      // 1. 대장르 메타데이터 노드 추가
      const parentGenreName = currentNode.parentGenre || 'Genre';
      nodes.push({
        id: 'g1',
        type: 'big_genre',
        name: parentGenreName,
        x: (Math.random() - 0.5) * 300,
        y: (Math.random() - 0.5) * 300
      });

      // 2. 아티스트 메타데이터 노드 추가
      const artistName = currentNode.trackSnapshot ? parseArtists(currentNode.trackSnapshot.artists) : 'Artist';
      nodes.push({
        id: 'a1',
        type: 'artist',
        name: artistName,
        x: (Math.random() - 0.5) * 300,
        y: (Math.random() - 0.5) * 300
      });

      // 3. 앨범 메타데이터 노드 추가
      const albumName = (currentNode.trackSnapshot as any)?.album_name || 'Album';
      nodes.push({
        id: 'al1',
        type: 'album',
        name: albumName,
        x: (Math.random() - 0.5) * 300,
        y: (Math.random() - 0.5) * 300
      });

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
        onItemClick: handleNodeClick
      };
    }

    // 2. Spaceship tuned view
    if (currentNode.type === 'spaceship') {
      const items = tunedTracks.map(t => ({
        id: t.track_id,
        name: t.name,
        type: 'song' as const,
        audioFeatures: t.features || { energy: t.energy, danceability: t.danceability, valence: t.valence } as any,
        artists: t.artists,
        albumCover: t.album_cover,
        rawObject: {
          id: t.track_id, type: 'song', name: t.name,
          trackSnapshot: t, audioFeatures: t.features, parentGenre: 'Tuned'
        }
      }));
      return {
        type: 'genre' as const,
        title: '추천 수록곡 목록',
        subtitle: '스포티파이 오디오 피처 유사도 분석 결과',
        items,
        onItemClick: handleNodeClick
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
          title: `${currentNode.name} 세부 장르`,
          subtitle: '세부 서브 장르를 클릭하여 탐사 대상을 좁히세요',
          items,
          onItemClick: handleNodeClick
        };
      } else {
        const songNodes = displayNodes.filter(n => n.type === 'song');
        const items = songNodes.map(n => ({
          id: n.id,
          name: n.name,
          type: 'song' as const,
          audioFeatures: n.audioFeatures,
          artists: n.trackSnapshot?.artists || '',
          albumCover: n.trackSnapshot?.album_cover || '',
          rawObject: n
        }));
        return {
          type: 'genre' as const,
          title: `${currentNode.name} 수록곡`,
          subtitle: '인기곡을 장르 탐험선에 탑재하여 오디오 신호를 수신하세요',
          items,
          onItemClick: handleNodeClick
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
        albumCover: n.trackSnapshot?.album_cover || '',
        rawObject: n
      }));
      return {
        type: 'genre' as const,
        title: `${currentNode.name} 수록곡`,
        subtitle: '세부 장르 소속 수록곡 신호 목록',
        items,
        onItemClick: handleNodeClick
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
        onAddToPlaylist: handleAddToPlaylist
      };
    }

    return {
      type: 'root' as const,
      title: '디깅 레이더 장르 목록',
      items: []
    };
  }, [currentNode, allGenresMeta, cachedGenres, exploreTab, refreshKey, displayNodes, tunedTracks, spotifyLoggedIn, isTrackLiked]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center font-sans">
        <div className="text-xl animate-pulse text-white/50 tracking-widest uppercase">Loading Universe...</div>
      </div>
    );
  }

  return (
    <div 
      className="w-screen h-screen bg-[#050505] text-white overflow-hidden font-sans selection:bg-[#B026FF]/30 grid relative box-border transition-all duration-500"
      style={{
        gridTemplateColumns: mode === 'home' ? '1fr' : '380px 1fr 320px',
        gridTemplateRows: '80px 1fr 80px',
      }}
    >
      {/* Row 1: Top HUD & Header */}
      <header 
        className="relative z-30 flex items-center justify-between px-8 box-border select-none border-b border-white/10"
        style={{
          gridRow: '1',
          gridColumn: mode === 'home' ? '1' : '1 / span 3',
          backgroundImage: `url(${spaceshipTexture})`,
          backgroundRepeat: 'repeat',
          backgroundSize: '200px 200px',
        }}
      >
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
              className={`text-xs font-medium rounded-full px-4 py-2 flex items-center gap-2 transition-colors ${spotifyLoggedIn
                  ? 'bg-[#1DB954] text-black hover:bg-[#1ed760]'
                  : 'bg-[#1DB954] text-black hover:bg-[#1ed760]'
                }`}
            >
              <SpotifyIcon /> {spotifyLoggedIn ? `Connected${spotifyProfile?.display_name ? ` (${spotifyProfile.display_name})` : ' ✓'}` : 'Connect to Spotify'}
            </button>
          </div>
        </div>
      </header>

      {/* Row 2, Column 1: Left Panel Zone */}
      {mode !== 'home' && (
        <div 
          className="relative flex flex-col justify-start min-h-0 border-r border-white/10"
          style={{
            gridRow: '2',
            gridColumn: '1',
            backgroundImage: `url(${spaceshipTexture})`,
            backgroundRepeat: 'repeat',
            backgroundSize: '200px 200px',
            padding: '12px',
          }}
        >
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
              />
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      {/* Row 2, Column 2: Center Space Window */}
      <div 
        className="relative h-full overflow-hidden min-h-0 flex items-center justify-center transition-all duration-500"
        style={{
          gridRow: '2',
          gridColumn: mode === 'home' ? '1' : '2',
          backgroundImage: `url(${spaceNebulaBg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* D3 Constellation Star Map */}
        <Constellation
          nodes={displayNodes}
          centerNode={currentNode || undefined}
          onNodeClick={handleNodeClick}
          activeNodeId={currentNode?.id}
          onPositionsSettled={handlePositionsSettled}
        />
        
        {/* TunedExplorePanel if mode is tuned and no node is selected */}
        {mode === 'tuned' && !currentNode && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <TunedExplorePanel onExplore={(features) => {
              setCurrentNode({ id: 'ship', type: 'spaceship', name: '', x: 50, y: 50 });
            }} />
          </div>
        )}

        {/* 웰컴/홈 오버레이 뷰 (mode === 'home') */}
        {mode === 'home' && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-between py-6 pointer-events-none bg-black/35 backdrop-blur-[2px]">
            <div className="text-center pointer-events-auto mt-[6vh] px-4">
              <h2 className="text-3xl md:text-4xl font-bold leading-tight mb-6 drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
                알고리즘을 벗어나,<br />당신만의 음악 우주를 탐험하세요.
              </h2>
              <div className="flex items-center justify-center gap-4">
                <button onClick={() => startExploreMode('genre')} className="px-6 py-3 rounded-full border border-[#B026FF] bg-[#2A0845]/70 text-white font-medium text-sm hover:bg-[#B026FF]/35 hover:shadow-[0_0_20px_rgba(176,38,255,0.5)] transition-all duration-300 backdrop-blur-sm cursor-pointer">
                  장르별 음악 탐색 시작
                </button>
                <button onClick={() => startExploreMode('song', 'tuned')} className="px-6 py-3 rounded-full border border-[#10B981] bg-[#064E3B]/70 text-white font-medium text-sm hover:bg-[#10B981]/35 hover:shadow-[0_0_20px_rgba(16,185,129,0.5)] transition-all duration-300 backdrop-blur-sm cursor-pointer">
                  노래 기반 탐색 시작
                </button>
              </div>
            </div>

            {/* Trending Section Overlay inside central view */}
            <div className="w-full max-w-5xl px-8 pointer-events-auto mb-[2vh]">
              <div className="flex items-center gap-3 mb-3 justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold tracking-widest text-[#00FFFF] font-mono uppercase">인기 트렌딩 디깅 트랙</h3>
                  <span className="px-2 py-0.5 bg-[#B026FF]/30 border border-[#B026FF]/50 rounded-full text-[9px] text-white/90 animate-pulse">Trending</span>
                </div>
                <span className="text-[10px] text-white/40 font-mono hidden sm:inline">← 마우스 휠을 굴려 가로로 스크롤하세요 →</span>
              </div>
              
              <div 
                onWheel={handleWheelScroll}
                className="flex gap-4 overflow-x-auto pb-3 snap-x snap-mandatory max-w-full custom-scrollbar scroll-smooth"
              >
                {homeTrending.slice(0, 10).map((track, i) => (
                  <div 
                    key={i} 
                    onClick={() => handleSearchSelectTrack(track, 'Trending')}
                    className="min-w-[160px] max-w-[160px] bg-black/60 rounded-xl p-3 border border-white/5 flex flex-col backdrop-blur-md snap-start cursor-pointer hover:border-[#00FFFF]/30 hover:bg-black/80 hover:scale-[1.03] transition-all duration-300 group shrink-0"
                  >
                    <div className="w-full aspect-square bg-[#111] rounded-lg mb-2 overflow-hidden border border-white/10 relative">
                      {track.album_cover ? (
                        <img src={track.album_cover} alt={track.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#1A0B2E] to-[#0A0518]">
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#B026FF]/50 animate-pulse mb-1">
                            <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                          </svg>
                          <span className="text-[8px] text-white/20 font-mono uppercase">Hologram</span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-[#00FFFF]/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                    </div>
                    <div className="text-[12px] text-white font-bold truncate group-hover:text-[#00FFFF] transition-colors leading-tight mb-0.5">{track.name}</div>
                    <div className="text-[10px] text-white/50 truncate mb-2">{parseArtists(track.artists)}</div>
                    
                    <div className="mt-auto">
                      <div className="flex items-center justify-between text-[9px] text-white/60 mb-1">
                        <span>⚡ Energy</span>
                        <span className="font-mono text-[#00FFFF] font-semibold">{(track.energy || track.features?.energy || 0.5).toFixed(2)}</span>
                      </div>
                      <div className="w-full bg-white/10 h-1 rounded-full overflow-hidden">
                        <div className="bg-gradient-to-r from-[#00FFFF] to-[#B026FF] h-full rounded-full transition-all duration-500" style={{ width: `${(track.energy || track.features?.energy || 0.5) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Row 2, Column 3: Right Panel Zone (Radar Chart & DBDIGGING LOG) */}
      {mode !== 'home' && (
        <div 
          className="relative flex flex-col justify-between gap-y-3 min-h-0 border-l border-white/10"
          style={{
            gridRow: '2',
            gridColumn: '3',
            backgroundImage: `url(${spaceshipTexture})`,
            backgroundRepeat: 'repeat',
            backgroundSize: '200px 200px',
            padding: '12px',
          }}
        >
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
                {(currentNode?.type === 'big_genre' || currentNode?.type === 'sub_genre') && currentNode.audioFeatures ? (
                  <RightPanel title={`${currentNode.name} 특성`} subtitle="장르 평균 분석" features={currentNode.audioFeatures} />
                ) : currentNode?.type === 'song' && currentNode.audioFeatures ? (
                  <RightPanel title="곡 오디오 분석" subtitle={currentNode.trackSnapshot!.name}
                    features={allGenresMeta.find(g => g.name === currentNode.parentGenre)?.average_audio_features || {}}
                    compareFeatures={currentNode.audioFeatures}
                  />
                ) : (
                  allGenresMeta.length > 0 && (
                    <RightPanel title={`${allGenresMeta[0].name} 특성`} subtitle="탐험대기 장르 가이드" features={allGenresMeta[0].average_audio_features} />
                  )
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
        </div>
      )}

      {/* Row 3: Bottom Console Frame */}
      <footer 
        className="relative z-20 select-none border-t border-white/10"
        style={{
          gridRow: '3',
          gridColumn: '1 / span 3',
          backgroundImage: `url(${spaceshipTexture})`,
          backgroundRepeat: 'repeat',
          backgroundSize: '200px 200px',
        }}
      />

      {/* Playlist Modal */}
      {showPlaylistModal && playlistTargetTrack && (
        <PlaylistModal
          trackId={playlistTargetTrack.id}
          trackName={playlistTargetTrack.name}
          spotifyLoggedIn={spotifyLoggedIn}
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
