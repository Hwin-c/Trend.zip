import React, { useEffect, useState } from 'react';
import { getUserPlaylists, addTrackToPlaylist, SpotifyPlaylist } from '../lib/spotify';

interface PlaylistModalProps {
  trackId: string;
  trackName: string;
  onClose: () => void;
}

export const PlaylistModal: React.FC<PlaylistModalProps> = ({ trackId, trackName, onClose }) => {
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);

  useEffect(() => {
    getUserPlaylists().then(p => {
      setPlaylists(p);
      setLoading(false);
    });
  }, []);

  const handleAdd = async (playlist: SpotifyPlaylist) => {
    setAddingTo(playlist.id);
    const success = await addTrackToPlaylist(playlist.id, trackId);
    setAddingTo(null);
    if (success) {
      setSuccessId(playlist.id);
      setTimeout(() => onClose(), 1200);
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
