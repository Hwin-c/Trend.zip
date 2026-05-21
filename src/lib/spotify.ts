// Spotify Web API client functions
// Phase 1: Album art via server proxy (no login needed)
// Phase 4: Like, playlists via user token (login required)

import { getAccessToken } from './spotifyAuth';

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
  try {
    const res = await fetch(`${SERVER_URL}/api/track/${trackId}`);
    if (!res.ok) return null;
    return res.json();
  } catch (error) {
    console.error('Failed to fetch track from Spotify:', error);
    return null;
  }
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
    const res = await spotifyFetch(`https://api.spotify.com/v1/me/tracks?ids=${trackId}`, {
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
    const res = await spotifyFetch(`https://api.spotify.com/v1/me/tracks?ids=${trackId}`, {
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
    const res = await spotifyFetch(`https://api.spotify.com/v1/me/tracks/contains?ids=${trackId}`);
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
    const res = await spotifyFetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
      method: 'POST',
      body: JSON.stringify({ uris: [`spotify:track:${cleanTrackId}`] }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('Spotify API Playlist Add Failed (Body POST). Status:', res.status, err);

      // Fallback: Query parameter based addition (standard fallback for some Spotify endpoints)
      console.log('Attempting query-parameter fallback for playlist addition...');
      const fallbackRes = await spotifyFetch(
        `https://api.spotify.com/v1/playlists/${playlistId}/tracks?uris=spotify:track:${cleanTrackId}`,
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
