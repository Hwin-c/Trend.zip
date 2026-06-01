// updatePopularity.js
// 🌌 DB 마이그레이션 스크립트: Spotify API 인기도 연동 및 Firestore 일괄 업데이트
import 'dotenv/config';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, query, limit, startAfter, writeBatch } from 'firebase/firestore';
import axios from 'axios';

/**
 * [설계 당위성 & 핵심 로직 설명 주석]
 * 
 * 1. Firestore 비용 및 메모리(OOM) 최적화 전략 (Pagination)
 *    - Firestore는 특정 필드가 존재하지 않는 문서(undefined/missing)를 직접 인덱싱하거나 필터링하는 전용 쿼리 연산자가 없습니다.
 *    - 따라서, 수천 수만 개의 전체 트랙 문서를 한 번에 로드(`getDocs`)하면 메모리가 초과되거나 엄청난 양의 무분별한 Firestore 읽기 요금이 발생합니다.
 *    - 이를 방지하기 위해 Cursor 기반의 페이징(`startAfter`, `limit(200)`)을 도입하여, 한 번에 200개씩만 순차적으로 로드해 메모리에서 `popularity === undefined` 또는 `popularity === -1`인 타겟 대상을 검출합니다.
 * 
 * 2. Spotify API 일괄 조회 (Batching)
 *    - 각 노래마다 Spotify API를 단건 호출할 경우, 수백 번의 HTTP Round-Trip이 발생해 네트워크 병목과 Spotify API Rate Limit(429)에 금방 도달하게 됩니다.
 *    - Spotify `/v1/tracks`는 여러 ID를 쉼표로 구분하여 최대 50개까지 동시에 일괄 조회할 수 있도록 설계되어 있으므로, 50개씩 청킹(Chunking)하여 일괄 호출해 API 비용과 대기 시간을 극대화로 줄입니다.
 * 
 * 3. Firestore Batch Write 적용
 *    - 업데이트를 수행할 때도 하나씩 `updateDoc`을 쓰면 매번 개별 커넥션 비용이 듭니다.
 *    - Firestore의 `writeBatch`를 사용하면 최대 500개의 쓰기 요청을 단 한 번의 원자적(Atomic) 트랜잭션으로 커밋할 수 있어 비용과 영속성 안전 측면에서 가장 미려한 해결책입니다.
 */

// 1. Firebase Config 초기화 (환경 변수로부터 로드)
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 2. Spotify Client Credentials 인증 토큰 발급 함수
async function getSpotifyAccessToken() {
  const clientId = process.env.SPOTIFY_CLIENT_ID || process.env.VITE_SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Spotify credentials are missing in environment variables (.env).");
  }

  const authOptions = {
    method: 'post',
    url: 'https://accounts.spotify.com/api/token',
    headers: {
      'Authorization': 'Basic ' + (Buffer.from(clientId + ':' + clientSecret).toString('base64')),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    data: 'grant_type=client_credentials'
  };

  const response = await axios(authOptions);
  return response.data.access_token;
}

// 3. Spotify API를 통해 최대 50개씩 묶어서(Batch) 트랙의 인기도 조회
async function fetchSpotifyPopularities(trackIds, token) {
  if (trackIds.length === 0) return {};
  
  const url = `https://api.spotify.com/v1/tracks?ids=${trackIds.join(',')}`;
  
  try {
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const results = {};
    if (response.data && response.data.tracks) {
      response.data.tracks.forEach(track => {
        if (track) {
          results[track.id] = track.popularity; // 0 ~ 100 사이의 인기도 정수값
        }
      });
    }
    return results;
  } catch (error) {
    console.error("❌ Error fetching popularities from Spotify:", error.response ? error.response.data : error.message);
    return {};
  }
}

// 4. 메인 마이그레이션 실행 함수
async function migrate() {
  console.log("🌌 Starting Spotify Popularity Migration Script...");
  
  let spotifyToken;
  try {
    spotifyToken = await getSpotifyAccessToken();
    console.log("🔑 Authenticated successfully with Spotify Client Credentials.");
  } catch (err) {
    console.error("❌ Spotify Auth Failure:", err.message);
    process.exit(1);
  }

  const tracksCollection = collection(db, 'tracks');
  let lastVisible = null;
  const chunkSize = 200; // Firestore 쿼리 비용과 메모리 절감을 위해 200개씩 끊어 로드
  let totalProcessed = 0;
  let totalUpdated = 0;
  let hasMore = true;

  while (hasMore) {
    console.log(`📦 Fetching next chunk of ${chunkSize} documents from Firestore...`);
    let q = query(tracksCollection, limit(chunkSize));
    if (lastVisible) {
      q = query(tracksCollection, startAfter(lastVisible), limit(chunkSize));
    }

    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      console.log("🏁 No more documents to process.");
      hasMore = false;
      break;
    }

    lastVisible = snapshot.docs[snapshot.docs.length - 1];
    const candidateTracks = [];

    snapshot.docs.forEach(docSnap => {
      const data = docSnap.data();
      totalProcessed++;
      
      // 핵심 필터: popularity 필드가 아예 없거나(undefined) 값이 -1인 노래 문서 추출
      const popularity = data.popularity;
      if (popularity === undefined || popularity === -1) {
        candidateTracks.push({
          docId: docSnap.id,
          trackId: data.track_id || docSnap.id
        });
      }
    });

    console.log(`🔍 Analyzed chunk: Found ${candidateTracks.length} targets needing Spotify popularity update.`);

    if (candidateTracks.length > 0) {
      // 50개씩 묶어서 Spotify API 일괄 호출 및 업데이트
      const spotifyBatchSize = 50;
      for (let i = 0; i < candidateTracks.length; i += spotifyBatchSize) {
        const batchCandidates = candidateTracks.slice(i, i + spotifyBatchSize);
        const trackIds = batchCandidates.map(c => c.trackId);
        
        console.log(`🎵 Querying Spotify API for ${trackIds.length} tracks...`);
        const popularityMap = await fetchSpotifyPopularities(trackIds, spotifyToken);

        // Firestore writeBatch 생성 (최대 500개 원자적 트랜잭션 묶음)
        const batch = writeBatch(db);
        let batchCount = 0;

        batchCandidates.forEach(candidate => {
          const spotifyPop = popularityMap[candidate.trackId];
          if (spotifyPop !== undefined) {
            const docRef = doc(db, 'tracks', candidate.docId);
            // 'popularity' 라는 신규 필드로 Spotify의 인기도(0~100)를 세팅
            batch.set(docRef, { popularity: spotifyPop }, { merge: true });
            batchCount++;
            totalUpdated++;
          }
        });

        if (batchCount > 0) {
          await batch.commit();
          console.log(`💾 Committed ${batchCount} track updates to Firestore.`);
        }
      }
    }
  }

  console.log(`\n🎉 [COMPLETE] Migration script finished successfully!`);
  console.log(`📊 Total documents scanned: ${totalProcessed}`);
  console.log(`⭐ Total documents updated: ${totalUpdated}`);
}

migrate().catch(console.error);
