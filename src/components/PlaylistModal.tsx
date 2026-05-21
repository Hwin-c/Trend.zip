import React, { useEffect, useState } from 'react';
import { getUserPlaylists, addTrackToPlaylist, SpotifyPlaylist } from '../lib/spotify';

interface PlaylistModalProps {
  trackId: string;
  trackName: string;
  spotifyLoggedIn: boolean;
  onClose: () => void;
}

export const PlaylistModal: React.FC<PlaylistModalProps> = ({ trackId, trackName, spotifyLoggedIn, onClose }) => {
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);

  useEffect(() => {
    if (!spotifyLoggedIn) {
      // Guest Mode: load playlists from localStorage with default placeholders if empty
      const localPlaylistsRaw = localStorage.getItem('guest_playlists');
      let localPlaylists: SpotifyPlaylist[] = localPlaylistsRaw ? JSON.parse(localPlaylistsRaw) : [];
      if (localPlaylists.length === 0) {
        localPlaylists = [
          { id: 'guest_pl_1', name: '🛸 Cosmic Voyage Digs', trackCount: 0, image: '', isPublic: true },
          { id: 'guest_pl_2', name: '✨ Starry Horizon Mix', trackCount: 0, image: '', isPublic: false }
        ];
        localStorage.setItem('guest_playlists', JSON.stringify(localPlaylists));
      }
      setPlaylists(localPlaylists);
      setLoading(false);
    } else {
      getUserPlaylists().then(p => {
        setPlaylists(p);
        setLoading(false);
      });
    }
  }, [spotifyLoggedIn]);

  const handleAdd = async (playlist: SpotifyPlaylist) => {
    setAddingTo(playlist.id);

    if (!spotifyLoggedIn) {
      // Guest local storage track insertion simulation
      const localPlaylistsRaw = localStorage.getItem('guest_playlists');
      let localPlaylists: SpotifyPlaylist[] = localPlaylistsRaw ? JSON.parse(localPlaylistsRaw) : [];
      
      const tracksKey = `guest_playlist_tracks_${playlist.id}`;
      const currentTracksRaw = localStorage.getItem(tracksKey);
      let currentTracks: string[] = currentTracksRaw ? JSON.parse(currentTracksRaw) : [];
      
      if (!currentTracks.includes(trackId)) {
        currentTracks.push(trackId);
        localStorage.setItem(tracksKey, JSON.stringify(currentTracks));
        
        localPlaylists = localPlaylists.map(pl => {
          if (pl.id === playlist.id) {
            return { ...pl, trackCount: currentTracks.length };
          }
          return pl;
        });
        localStorage.setItem('guest_playlists', JSON.stringify(localPlaylists));
        setPlaylists(localPlaylists);
      }
      
      setAddingTo(null);
      setSuccessId(playlist.id);
      setTimeout(() => onClose(), 1200);
      return;
    }

    const success = await addTrackToPlaylist(playlist.id, trackId);
    setAddingTo(null);
    if (success) {
      setSuccessId(playlist.id);
      setTimeout(() => onClose(), 1200);
    } else {
      alert(
        '스포티파이 플레이리스트에 곡을 추가하지 못했습니다. (Spotify API 403 오류 등)\n\n원인 및 해결 방법:\n' +
        '1. [권한 갱신 필요] 이전에 로그인한 세션에 권한(Scope)이 누락되었을 수 있습니다. 상단 우측 스포티파이 연결 완료 버튼을 눌러 로그아웃한 후, 다시 로그인해 주세요.\n' +
        '2. [테스터 계정 등록 필요] 스포티파이 앱이 개발 모드인 경우, 등록된 개발자 계정 또는 테스터(Users and Requests) 계정으로만 수정 권한 API 호출이 허용됩니다.\n' +
        '3. [플레이리스트 소유권] 본인이 생성하거나 편집 권한(협업 가능)이 있는 플레이리스트가 맞는지 확인해 주세요. 다른 유저의 플레이리스트에는 곡을 추가할 수 없습니다.'
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="bg-[#1A1A1A] border border-white/10 rounded-2xl w-[380px] max-h-[500px] overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-white/5">
          <h3 className="text-lg font-medium text-white mb-1">플레이리스트에 추가</h3>
          <p className="text-xs text-white/40 truncate">{trackName}</p>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[380px] p-2">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-sm text-white/30 animate-pulse">플레이리스트 불러오는 중...</div>
            </div>
          ) : playlists.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-sm text-white/30">플레이리스트가 없습니다</div>
            </div>
          ) : (
            playlists.map(p => (
              <button
                key={p.id}
                onClick={() => handleAdd(p)}
                disabled={addingTo !== null}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors text-left disabled:opacity-50"
              >
                {/* Playlist Image */}
                <div className="w-10 h-10 rounded-lg bg-white/5 overflow-hidden shrink-0 border border-white/10">
                  {p.image ? (
                    <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/20 text-xs">♫</div>
                  )}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-white truncate">{p.name}</div>
                  <div className="text-xs text-white/30">{p.trackCount}곡 · {p.isPublic ? '공개' : '비공개'}</div>
                </div>

                {/* Status */}
                {addingTo === p.id && (
                  <div className="text-xs text-white/40 animate-pulse shrink-0">추가 중...</div>
                )}
                {successId === p.id && (
                  <div className="text-xs text-[#1DB954] shrink-0">✓ 추가됨</div>
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/5">
          <button 
            onClick={onClose}
            className="w-full py-2 text-sm text-white/50 hover:text-white transition-colors rounded-lg hover:bg-white/5"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};
