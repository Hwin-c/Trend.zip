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
 * [API 1] 노래 상세 정보 및 미리듣기 URL 가져오기
 */
app.get('/api/track/:id', async (req, res) => {
  try {
    if (!accessToken) {
      await getSpotifyToken();
    }

    let response;
    try {
      response = await axios.get(`https://api.spotify.com/v1/tracks/${req.params.id}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
    } catch (err) {
      if (err.response && (err.response.status === 401 || err.response.status === 403)) {
        console.log('🔄 Token expired or invalid for track API. Refreshing token...');
        await getSpotifyToken();
        response = await axios.get(`https://api.spotify.com/v1/tracks/${req.params.id}`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
      } else {
        throw err;
      }
    }

    const trackInfo = {
      name: response.data.name,
      preview_url: response.data.preview_url,
      album_art: response.data.album.images[0]?.url,
      artists: response.data.artists.map(a => a.name),
      external_url: response.data.external_urls.spotify
    };

    res.json(trackInfo);
  } catch (error) {
    console.error("❌ Track Fetch Error:", error.response ? error.response.data : error.message);
    res.status(500).json({ error: "Track not found or API error" });
  }
});

/**
 * [API 2] 아티스트 상세 정보 가져오기
 */
app.get('/api/artist/:id', async (req, res) => {
  try {
    if (!accessToken) {
      await getSpotifyToken();
    }

    let response;
    try {
      response = await axios.get(`https://api.spotify.com/v1/artists/${req.params.id}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
    } catch (err) {
      if (err.response && (err.response.status === 401 || err.response.status === 403)) {
        console.log('🔄 Token expired or invalid for artist API. Refreshing token...');
        await getSpotifyToken();
        response = await axios.get(`https://api.spotify.com/v1/artists/${req.params.id}`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
      } else {
        throw err;
      }
    }

    res.json({
      name: response.data.name,
      image: response.data.images[0]?.url,
      genres: response.data.genres,
      followers: response.data.followers.total,
      external_url: response.data.external_urls.spotify
    });
  } catch (error) {
    console.error("❌ Artist Fetch Error:", error.response ? error.response.data : error.message);
    res.status(500).json({ error: "Artist not found or API error" });
  }
});

app.get('/', (req, res) => {
  res.send('🌌 DBdigging Backend Server is Running!');
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 DBdigging Server running on http://localhost:${PORT}`);
});