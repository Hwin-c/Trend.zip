// Spotify Web API client functions
// Phase 1: Album art via server proxy (no login needed)
// Phase 4: Like, playlists via user token (login required)

import { getAccessToken } from './spotifyAuth';
import { db } from './firebase';
import { doc, getDoc, collection, getDocs, query, where, documentId } from 'firebase/firestore';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:10000';

// --- Phase 1: Album Art (via server.js proxy, no user login) ---

export interface SpotifyTrackInfo {
  name: string;
  preview_url: string | null;
  album_art: string;
  artists: string[];
  external_url: string;
}

export async function fetchTrackFromSpotify(trackId: string): Promise<SpotifyTrackInfo | null> {
  const cleanTrackId = trackId.replace('spotify:track:', '');

  // Tier 1: If browser has a valid Spotify User Access Token, perform direct client-side fetch.
  const userToken = getAccessToken();
  if (userToken) {
    try {
      const response = await fetch(`https://api.spotify.com/v1/tracks/${cleanTrackId}`, {
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        return {
          name: data.name,
          preview_url: data.preview_url,
          album_art: data.album.images[0]?.url || '',
          artists: data.artists.map((a: any) => a.name),
          external_url: data.external_urls.spotify,
        };
      }
      console.warn('Spotify Direct Fetch failed. Falling back to server proxy.');
    } catch (directError) {
      console.error('Failed to fetch directly from Spotify API:', directError);
    }
  }

  // Tier 2 Fallback: Request via the backend proxy server.
  try {
    const res = await fetch(`${SERVER_URL}/api/track/${cleanTrackId}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.album_art && data.album_art.length > 5) {
        return data;
      }
    }
  } catch (error) {
    console.error('Failed to fetch track from Spotify proxy server:', error);
  }

  // [Ultra Shield Tier 3] Spotify API & Proxy both failed (e.g. 429 Rate Limit / 403 Forbidden)
  // Retrieve the original album cover and info directly from Firestore DB in 0.01s!
  try {
    console.log(`🌌 [Ultra Shield] Recovering track ${cleanTrackId} directly from Firestore DB...`);
    const trackDocRef = doc(db, 'tracks', cleanTrackId);
    const trackDocSnap = await getDoc(trackDocRef);
    if (trackDocSnap.exists()) {
      const dbData = trackDocSnap.data();
      
      let parsedArtists: string[] = ['Unknown Artist'];
      const rawArtists = dbData.artists || '';
      if (rawArtists) {
        try {
          const cleaned = rawArtists.replace(/'/g, '"');
          const arr = JSON.parse(cleaned);
          if (Array.isArray(arr)) parsedArtists = arr;
        } catch {
          parsedArtists = [rawArtists.replace(/[\[\]']/g, '').trim()];
        }
      }

      return {
        name: dbData.name || 'Unknown Track',
        preview_url: dbData.preview_url || null,
        album_art: dbData.album_cover || dbData.album_art || '',
        artists: parsedArtists,
        external_url: `https://open.spotify.com/track/${cleanTrackId}`
      };
    }
  } catch (dbError) {
    console.error('Failed to fallback to Firestore track recovery:', dbError);
  }

  return null;
}

export async function fetchTracksFromSpotify(trackIds: string[]): Promise<Record<string, SpotifyTrackInfo>> {
  if (!trackIds || trackIds.length === 0) return {};

  const cleanIds = trackIds.map(id => id.replace('spotify:track:', ''));
  const result: Record<string, SpotifyTrackInfo> = {};
  const missingIds: string[] = [];

  // Tier 1: If browser has a valid Spotify User Access Token, perform direct client-side fetch.
  const userToken = getAccessToken();
  if (userToken) {
    const directFetch = async (idsChunk: string[], attempt = 1): Promise<any> => {
      try {
        const response = await fetch(`https://api.spotify.com/v1/tracks?ids=${idsChunk.join(',')}`, {
          headers: {
            Authorization: `Bearer ${userToken}`,
          },
        });

        if (response.ok) {
          return await response.json();
        }

        if (response.status === 429 && attempt <= 2) {
          const retryAfter = parseInt(response.headers.get('Retry-After') || '2', 10);
          console.warn(`⚠️ [Client Direct] Spotify API 429 Rate Limit. Retry-After: ${retryAfter} seconds. Waiting...`);
          await new Promise(resolve => setTimeout(resolve, (retryAfter * 1000) + 100));
          return directFetch(idsChunk, attempt + 1);
        }

        throw new Error(`Direct batch fetch status: ${response.status}`);
      } catch (err) {
        console.error('Direct batch fetch failed:', err);
        return null;
      }
    };

    try {
      const chunks: string[][] = [];
      for (let i = 0; i < cleanIds.length; i += 50) {
        chunks.push(cleanIds.slice(i, i + 50));
      }

      for (const chunk of chunks) {
        const data = await directFetch(chunk);
        if (data && data.tracks) {
          data.tracks.forEach((track: any, index: number) => {
            const requestedId = chunk[index];
            if (track) {
              result[requestedId] = {
                name: track.name,
                preview_url: track.preview_url,
                album_art: track.album.images[0]?.url || '',
                artists: track.artists.map((a: any) => a.name),
                external_url: track.external_urls.spotify,
              };
            }
          });
        } else {
          missingIds.push(...chunk);
        }
      }

      if (Object.keys(result).length === cleanIds.length) {
        const finalResult: Record<string, SpotifyTrackInfo> = {};
        for (const [id, info] of Object.entries(result)) {
          finalResult[id] = info;
          finalResult[`spotify:track:${id}`] = info;
        }
        return finalResult;
      }
    } catch (err) {
      console.error('Failed to direct fetch batch, falling back to proxy:', err);
    }
  }

  // Tier 2 Fallback: Fetch via Backend Proxy
  const proxyIds = cleanIds.filter(id => !result[id]);
  if (proxyIds.length > 0) {
    try {
      const chunks: string[][] = [];
      for (let i = 0; i < proxyIds.length; i += 50) {
        chunks.push(proxyIds.slice(i, i + 50));
      }

      for (const chunk of chunks) {
        const res = await fetch(`${SERVER_URL}/api/tracks?ids=${chunk.join(',')}`);
        if (res.ok) {
          const data = await res.json();
          Object.assign(result, data);
        } else {
          chunk.forEach(id => {
            result[id] = {
              name: 'Rate Limited/Error Track',
              preview_url: null,
              album_art: '',
              artists: ['Spotify API'],
              external_url: '#',
            };
          });
        }
      }
    } catch (error) {
      console.error('Failed to fetch batch tracks from Spotify proxy server:', error);
    }
  }

  // [Ultra Shield Tier 3] For any tracks that failed or returned empty album arts due to Spotify blockages,
  // perform a bulk Firestore DB query to retrieve original album covers and metadata directly!
  const finalMissingIds = cleanIds.filter(id => {
    const item = result[id];
    return !item || !item.album_art || item.album_art === '';
  });

  if (finalMissingIds.length > 0) {
    try {
      console.log(`🌌 [Ultra Shield Batch] Recovering ${finalMissingIds.length} tracks directly from Firestore DB...`);
      const chunks: string[][] = [];
      for (let i = 0; i < finalMissingIds.length; i += 30) {
        chunks.push(finalMissingIds.slice(i, i + 30));
      }

      for (const chunk of chunks) {
        const tracksRef = collection(db, 'tracks');
        const q = query(tracksRef, where(documentId(), 'in', chunk));
        const qSnap = await getDocs(q);

        qSnap.docs.forEach(docSnap => {
          const dbData = docSnap.data();
          const tid = docSnap.id;
          
          let parsedArtists: string[] = ['Unknown Artist'];
          const rawArtists = dbData.artists || '';
          if (rawArtists) {
            try {
              const cleaned = rawArtists.replace(/'/g, '"');
              const arr = JSON.parse(cleaned);
              if (Array.isArray(arr)) parsedArtists = arr;
            } catch {
              parsedArtists = [rawArtists.replace(/[\[\]']/g, '').trim()];
            }
          }

          result[tid] = {
            name: dbData.name || 'Unknown Track',
            preview_url: dbData.preview_url || null,
            album_art: dbData.album_cover || dbData.album_art || '',
            artists: parsedArtists,
            external_url: `https://open.spotify.com/track/${tid}`
          };
        });
      }
    } catch (dbError) {
      console.error('Failed to bulk recover tracks from Firestore:', dbError);
    }
  }

  // Fallback for remaining completely unresolved items
  cleanIds.forEach(id => {
    if (!result[id]) {
      result[id] = {
        name: 'Unknown Track',
        preview_url: null,
        album_art: '',
        artists: ['Unknown Artist'],
        external_url: '#',
      };
    }
  });

  const finalResult: Record<string, SpotifyTrackInfo> = {};
  for (const [id, info] of Object.entries(result)) {
    finalResult[id] = info;
    finalResult[`spotify:track:${id}`] = info;
  }

  return finalResult;
}

// --- Phase 4: User-scoped API calls (requires PKCE login) ---

async function spotifyFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getAccessToken();
  if (!token) throw new Error('Not logged in to Spotify');

  return fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
}

// --- Like / Save Track ---

export async function saveTrack(trackId: string): Promise<boolean> {
  try {
    const cleanId = trackId.replace('spotify:track:', '');
    const encodedUri = encodeURIComponent(`spotify:track:${cleanId}`);
    const res = await spotifyFetch(`https://api.spotify.com/v1/me/library?uris=${encodedUri}`, {
      method: 'PUT',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('Failed to save track status:', res.status, err);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Failed to save track:', error);
    return false;
  }
}

export async function removeSavedTrack(trackId: string): Promise<boolean> {
  try {
    const cleanId = trackId.replace('spotify:track:', '');
    const encodedUri = encodeURIComponent(`spotify:track:${cleanId}`);
    const res = await spotifyFetch(`https://api.spotify.com/v1/me/library?uris=${encodedUri}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('Failed to remove saved track status:', res.status, err);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Failed to remove saved track:', error);
    return false;
  }
}

export async function checkSavedTrack(trackId: string): Promise<boolean> {
  try {
    const cleanId = trackId.replace('spotify:track:', '');
    const encodedUri = encodeURIComponent(`spotify:track:${cleanId}`);
    const res = await spotifyFetch(`https://api.spotify.com/v1/me/library/contains?uris=${encodedUri}`);
    if (!res.ok) return false;
    const data = await res.json();
    return data[0] === true;
  } catch {
    return false;
  }
}

// --- Playlists ---

export interface SpotifyPlaylist {
  id: string;
  name: string;
  image?: string;
  trackCount: number;
  isPublic: boolean;
}

export async function getUserPlaylists(): Promise<SpotifyPlaylist[]> {
  try {
    const res = await spotifyFetch('https://api.spotify.com/v1/me/playlists?limit=50');
    if (!res.ok) {
      console.error('Failed to fetch user playlists. Spotify Status:', res.status);
      return [];
    }
    const data = await res.json();
    console.log('Spotify Playlists Raw API Response:', data);
    return data.items.map((p: any) => {
      // High-robustness fallback for track count parsing
      let trackCount = 0;
      if (p.tracks) {
        if (typeof p.tracks.total === 'number') {
          trackCount = p.tracks.total;
        } else if (typeof p.tracks === 'number') {
          trackCount = p.tracks;
        } else if (Array.isArray(p.tracks)) {
          trackCount = p.tracks.length;
        }
      }
      return {
        id: p.id,
        name: p.name,
        image: p.images?.[0]?.url || '',
        trackCount: trackCount,
        isPublic: p.public,
      };
    });
  } catch (error) {
    console.error('Failed to fetch playlists:', error);
    return [];
  }
}

export async function addTrackToPlaylist(playlistId: string, trackId: string): Promise<boolean> {
  try {
    // Standard body-based addition first
    const cleanTrackId = trackId.replace('spotify:track:', '');
    const res = await spotifyFetch(`https://api.spotify.com/v1/playlists/${playlistId}/items`, {
      method: 'POST',
      body: JSON.stringify({ uris: [`spotify:track:${cleanTrackId}`] }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('Spotify API Playlist Add Failed (Body POST). Status:', res.status, err);

      // Fallback: Query parameter based addition (standard fallback for some Spotify endpoints)
      console.log('Attempting query-parameter fallback for playlist addition...');
      const encodedUri = encodeURIComponent(`spotify:track:${cleanTrackId}`);
      const fallbackRes = await spotifyFetch(
        `https://api.spotify.com/v1/playlists/${playlistId}/items?uris=${encodedUri}`,
        {
          method: 'POST',
        }
      );

      if (!fallbackRes.ok) {
        const fallbackErr = await fallbackRes.json().catch(() => ({}));
        console.error('Spotify API Playlist Add Failed (Query POST). Status:', fallbackRes.status, fallbackErr);
        return false;
      }
      console.log('Playlist addition succeeded via query-parameter fallback.');
      return true;
    }

    console.log('Playlist addition succeeded via JSON body.');
    return true;
  } catch (error) {
    console.error('Failed to add track to playlist:', error);
    return false;
  }
}
