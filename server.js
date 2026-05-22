// server.js
import 'dotenv/config'; // require('dotenv').config() 대신 사용
import express from 'express';
import axios from 'axios';
import cors from 'cors';

const app = express();

// 미들웨어 설정
app.use(cors());
app.use(express.json());

// 1. Spotify API 인증 설정
let accessToken = '';
const client_id = process.env.SPOTIFY_CLIENT_ID;
const client_secret = process.env.SPOTIFY_CLIENT_SECRET;

if (!client_id || !client_secret) {
  console.error('❌ ERROR: SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET is missing in .env file');
}

// Spotify API 응답 캐싱을 위한 인메모리 캐시
const trackCache = new Map();
const artistCache = new Map();

/**
 * Spotify Access Token을 발급받는 함수
 */
const getSpotifyToken = async () => {
  const authOptions = {
    method: 'post',
    url: 'https://accounts.spotify.com/api/token',
    headers: {
      'Authorization': 'Basic ' + (Buffer.from(client_id + ':' + client_secret).toString('base64')),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    data: 'grant_type=client_credentials'
  };

  try {
    const response = await axios(authOptions);
    accessToken = response.data.access_token;
    console.log(`✅ New Spotify Token Generated: ${new Date().toLocaleString()}`);
  } catch (error) {
    console.error("❌ Spotify Token Error:", error.response ? error.response.data : error.message);
  }
};

// 서버 시작 시 토큰 최초 발급 및 50분마다 자동 갱신
getSpotifyToken();
setInterval(getSpotifyToken, 1000 * 60 * 50);

/**
 * Spotify API GET 요청을 위한 공통 래퍼 함수 (인증 갱신 및 429 Rate Limit 대응)
 */
const spotifyGet = async (url) => {
  if (!accessToken) {
    await getSpotifyToken();
  }
  
  const execute = async (attempt = 1) => {
    try {
      const response = await axios.get(url, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      return response;
    } catch (err) {
      if (err.response) {
        const status = err.response.status;
        
        // 401 인증 만료 시 토큰 재갱신 후 재시도 (403은 권한 문제이므로 무한루프 방지를 위해 제외)
        if (status === 401 && attempt <= 2) {
          console.log(`🔄 [Backend Proxy] Token expired or invalid (${status}). Refreshing token...`);
          await getSpotifyToken();
          return execute(attempt + 1);
        }
        
        // 429 Rate Limit 발생 시 대기 없이 즉각 throw (IP 락 연장 방지)
        if (status === 429) {
          console.warn(`⚠️ [Backend Proxy] Spotify API 429 Rate Limit detected. Skipping wait to prevent IP block lock.`);
          throw err;
        }
      }
      throw err;
    }
  };
  
  return execute();
};

/**
 * [API 1] 노래 상세 정보 및 미리듣기 URL 가져오기
 */
app.get('/api/track/:id', async (req, res) => {
  const trackId = req.params.id;

  // 캐시 확인
  if (trackCache.has(trackId)) {
    return res.json(trackCache.get(trackId));
  }

  try {
    const response = await spotifyGet(`https://api.spotify.com/v1/tracks/${trackId}`);
    const trackInfo = {
      name: response.data.name,
      preview_url: response.data.preview_url,
      album_art: response.data.album.images[0]?.url || "",
      artists: response.data.artists.map(a => a.name),
      external_url: response.data.external_urls.spotify
    };

    // 캐시에 저장 (유효한 앨범 자켓이 있을 때만 허용)
    if (trackInfo.album_art) {
      trackCache.set(trackId, trackInfo);
    }

    res.json(trackInfo);
  } catch (error) {
    console.error("❌ Track Fetch Error:", error.response ? error.response.data : error.message);
    
    // 429 Rate Limit 또는 기타 API 에러 시 프론트엔드가 크래시되지 않도록 fallback 응답 (200 OK)
    if (error.response && error.response.status === 429) {
      console.warn("⚠️ Spotify API Rate Limit (429) encountered. Returning fallback track info.");
      return res.json({
        name: "Rate Limited Track",
        preview_url: null,
        album_art: "",
        artists: ["Spotify API"],
        external_url: "#"
      });
    }
    
    res.status(500).json({ error: "Track not found or API error" });
  }
});

/**
 * [API 2] 여러 노래 상세 정보 일괄(Batch) 가져오기
 * GET /api/tracks?ids=id1,id2,id3,...
 */
app.get('/api/tracks', async (req, res) => {
  const idsParam = req.query.ids;
  if (!idsParam) {
    return res.json({});
  }

  const ids = idsParam.split(',').map(id => id.trim()).filter(id => id.length > 0);
  const result = {};
  const missingIds = [];

  // 캐시 먼저 확인
  for (const id of ids) {
    if (trackCache.has(id)) {
      result[id] = trackCache.get(id);
    } else {
      missingIds.push(id);
    }
  }

  // 캐시에 없는 트랙들은 50개 단위 청크로 Spotify API 일괄 조회
  if (missingIds.length > 0) {
    try {
      const chunks = [];
      for (let i = 0; i < missingIds.length; i += 50) {
        chunks.push(missingIds.slice(i, i + 50));
      }

      for (const chunk of chunks) {
        const url = `https://api.spotify.com/v1/tracks?ids=${chunk.join(',')}`;
        const response = await spotifyGet(url);
        
        if (response && response.data && response.data.tracks) {
          response.data.tracks.forEach((track, index) => {
            const requestedId = chunk[index];
            if (track) {
              const trackInfo = {
                name: track.name,
                preview_url: track.preview_url,
                album_art: track.album.images[0]?.url || "",
                artists: track.artists.map(a => a.name),
                external_url: track.external_urls.spotify
              };
              // 캐시에 저장 (유효한 앨범 자켓이 있을 때만 허용)
              if (trackInfo.album_art) {
                trackCache.set(track.id || requestedId, trackInfo);
              }
              result[track.id || requestedId] = trackInfo;
            } else {
              // Spotify에 없는 트랙 처리 (오염 캐싱 금지, 임시 result 응답만 전달)
              const fallback = {
                name: "Unknown Track",
                preview_url: null,
                album_art: "",
                artists: ["Unknown Artist"],
                external_url: "#"
              };
              result[requestedId] = fallback;
            }
          });
        }
      }
    } catch (error) {
      console.error("❌ Batch Track Fetch Error:", error.response ? error.response.data : error.message);
      
      // 에러 발생 시 누락된 트랙들을 위해 fallback 데이터 공급
      for (const id of missingIds) {
        if (!result[id]) {
          result[id] = {
            name: "Rate Limited/Error Track",
            preview_url: null,
            album_art: "",
            artists: ["Spotify API"],
            external_url: "#"
          };
        }
      }
    }
  }

  res.json(result);
});

/**
 * [API 3] 아티스트 상세 정보 가져오기
 */
app.get('/api/artist/:id', async (req, res) => {
  const artistId = req.params.id;

  // 캐시 확인
  if (artistCache.has(artistId)) {
    return res.json(artistCache.get(artistId));
  }

  try {
    const response = await spotifyGet(`https://api.spotify.com/v1/artists/${artistId}`);
    const artistInfo = {
      name: response.data.name,
      image: response.data.images[0]?.url || "",
      genres: response.data.genres,
      followers: response.data.followers.total,
      external_url: response.data.external_urls.spotify
    };

    // 캐시에 저장
    artistCache.set(artistId, artistInfo);

    res.json(artistInfo);
  } catch (error) {
    console.error("❌ Artist Fetch Error:", error.response ? error.response.data : error.message);

    // 429 Rate Limit 또는 기타 API 에러 시 프론트엔드가 크래시되지 않도록 fallback 응답 (200 OK)
    if (error.response && error.response.status === 429) {
      console.warn("⚠️ Spotify API Rate Limit (429) encountered. Returning fallback artist info.");
      return res.json({
        name: "Rate Limited Artist",
        image: "",
        genres: [],
        followers: 0,
        external_url: "#"
      });
    }

    res.status(500).json({ error: "Artist not found or API error" });
  }
});

// 실시간 대한민국 인기 차트 캐싱 및 프록시 API
let trendingCache = null;
let trendingCacheTime = 0;

/**
 * Spotify 플레이리스트 URL 또는 ID에서 22자리 고유 식별자만 추출합니다.
 */
function extractPlaylistId(urlOrId) {
  if (!urlOrId) return '3i51Pj9TZKrH2waJP8NRM5';
  
  const cleanInput = String(urlOrId).trim();
  
  // 1. URL 패턴 매칭 (예: https://open.spotify.com/playlist/3i51Pj9TZKrH2waJP8NRM5?si=...)
  const match = cleanInput.match(/\/playlist\/([a-zA-Z0-9]{22})/);
  if (match) {
    return match[1];
  }
  
  // 2. 쿼리 파라미터 분리 및 정밀 22자리 검증
  const cleanId = cleanInput.split('?')[0].trim();
  if (/^[a-zA-Z0-9]{22}$/.test(cleanId)) {
    return cleanId;
  }
  
  return cleanId;
}

app.get('/api/trending', async (req, res) => {
  const now = Date.now();
  // 1시간 캐싱 적용
  if (trendingCache && (now - trendingCacheTime < 1000 * 60 * 60)) {
    return res.json(trendingCache);
  }

  const rawPlaylistTarget = process.env.SPOTIFY_PLAYLIST_URL || process.env.VITE_SPOTIFY_PLAYLIST_URL || '3i51Pj9TZKrH2waJP8NRM5';
  const playlistId = extractPlaylistId(rawPlaylistTarget);

  console.log(`🌌 [Backend Proxy] Loading playlist ID: ${playlistId} (source: ${rawPlaylistTarget})`);

  try {
    const response = await spotifyGet(`https://api.spotify.com/v1/playlists/${playlistId}`);
    if (response && response.data && response.data.tracks && response.data.tracks.items) {
      const tracks = response.data.tracks.items.map((item, idx) => {
        if (!item.track) return null;
        return {
          rank: idx + 1,
          track_id: item.track.id,
          name: item.track.name,
          artists: item.track.artists ? item.track.artists.map(a => a.name) : ["Unknown Artist"],
          album_name: item.track.album ? item.track.album.name : "Unknown Album",
          album_cover: item.track.album && item.track.album.images && item.track.album.images[0] ? item.track.album.images[0].url : "",
          duration_ms: item.track.duration_ms || 0,
          popularity: item.track.popularity || 0
        };
      }).filter(Boolean);
      
      trendingCache = tracks;
      trendingCacheTime = now;
      return res.json(tracks);
    }
    throw new Error("Invalid response format from Spotify playlist API");
  } catch (error) {
    console.error("❌ Trending Fetch Error:", error.response ? error.response.data : error.message);
    if (trendingCache) {
      console.warn("⚠️ Using expired trending cache as fallback.");
      return res.json(trendingCache);
    }
    res.status(502).json({ 
      error: "Bad Gateway", 
      message: "Failed to connect to Spotify Playlist API",
      details: error.response ? error.response.data : error.message 
    });
  }
});

app.get('/', (req, res) => {
  res.send('🌌 DBdigging Backend Server is Running!');
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 DBdigging Server running on http://localhost:${PORT}`);
});