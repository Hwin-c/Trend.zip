import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';

const TestPlayer = () => {
  const [trackData, setTrackData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchRandomTrack = async () => {
      try {
        setLoading(true);
        // 1. Firestore의 'tracks' 컬렉션에서 데이터 가져오기 (테스트를 위해 10개만 가져와서 랜덤 선택)
        const tracksRef = collection(db, 'tracks');
        const q = query(tracksRef, limit(10));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
          throw new Error('Firestore에 트랙 데이터가 없습니다.');
        }

        // 임의의 문서 하나 선택
        const docs = snapshot.docs;
        const randomDoc = docs[Math.floor(Math.random() * docs.length)];
        const spotifyId = randomDoc.data().Id;

        if (!spotifyId) {
          throw new Error('선택된 문서에 Id 필드가 없습니다.');
        }

        // 2. 내 Render 백엔드 서버(http://localhost:10000) API 호출
        const response = await fetch(`http://localhost:10000/api/track/${spotifyId}`);
        
        if (!response.ok) {
          throw new Error('백엔드 서버에서 데이터를 가져오는데 실패했습니다.');
        }

        const data = await response.json();
        setTrackData(data);
      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchRandomTrack();
  }, []);

  if (loading) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>데이터를 불러오는 중...</div>;
  }

  if (error) {
    return <div style={{ padding: '20px', color: 'red', textAlign: 'center' }}>에러 발생: {error}</div>;
  }

  if (!trackData) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>트랙 데이터가 없습니다.</div>;
  }

  return (
    <div style={{
      maxWidth: '400px',
      margin: '40px auto',
      padding: '20px',
      borderRadius: '12px',
      boxShadow: '0 8px 16px rgba(0,0,0,0.1)',
      backgroundColor: '#fff',
      textAlign: 'center',
      fontFamily: 'sans-serif'
    }}>
      {/* 앨범 이미지 */}
      {(trackData.albumImage || trackData.album_image) && (
        <img 
          src={trackData.albumImage || trackData.album_image} 
          alt={`${trackData.title} 앨범 이미지`} 
          style={{ width: '100%', borderRadius: '8px', marginBottom: '16px' }}
        />
      )}

      {/* 곡 제목 (h2) */}
      <h2 style={{ margin: '0 0 8px 0', fontSize: '1.5rem', color: '#333' }}>
        {trackData.title || '제목 없음'}
      </h2>

      {/* 아티스트 이름 (p) */}
      <p style={{ margin: '0 0 24px 0', color: '#666', fontSize: '1rem' }}>
        {trackData.artist || '알 수 없는 아티스트'}
      </p>

      {/* 30초 미리듣기 재생 플레이어 */}
      {(trackData.previewUrl || trackData.preview_url) ? (
        <audio 
          controls 
          src={trackData.previewUrl || trackData.preview_url} 
          style={{ width: '100%' }}
        >
          브라우저가 audio 태그를 지원하지 않습니다.
        </audio>
      ) : (
        <div style={{ 
          padding: '12px', 
          backgroundColor: '#f5f5f5', 
          borderRadius: '8px', 
          color: '#888',
          fontSize: '0.9rem'
        }}>
          미리듣기를 제공하지 않는 곡입니다.
        </div>
      )}
    </div>
  );
};

export default TestPlayer;
