import React from 'react';
import { ParentGenre, TrackSnapshot, NodeData } from '../types';

interface SearchDropdownProps {
  query: string;
  genres: Pick<ParentGenre, 'id' | 'name' | 'average_audio_features'>[];
  cachedGenres: Map<string, ParentGenre>;
  onSelectGenre: (genre: Pick<ParentGenre, 'id' | 'name' | 'average_audio_features'>) => void;
  onSelectTrack: (track: TrackSnapshot, parentGenreName: string) => void;
  onClose: () => void;
}

export const SearchDropdown: React.FC<SearchDropdownProps> = ({
  query, genres, cachedGenres, onSelectGenre, onSelectTrack, onClose
}) => {
  if (!query.trim()) return null;

  const q = query.toLowerCase().trim();

  // Filter genres (zero Firestore reads — uses already-loaded allGenresMeta)
  const matchedGenres = genres.filter(g => g.name.toLowerCase().includes(q)).slice(0, 5);

  // Filter tracks from cached data only (zero Firestore reads)
  const matchedTracks: { track: TrackSnapshot; parentGenreName: string }[] = [];
  cachedGenres.forEach((parentGenre) => {
    parentGenre.top_tracks?.forEach(t => {
      if (t.name.toLowerCase().includes(q) || t.artists.toLowerCase().includes(q)) {
        matchedTracks.push({ track: t, parentGenreName: parentGenre.name });
      }
    });
    parentGenre.sub_genres_data?.forEach(sg => {
      sg.top_tracks?.forEach(t => {
        if (t.name.toLowerCase().includes(q) || t.artists.toLowerCase().includes(q)) {
          matchedTracks.push({ track: t, parentGenreName: parentGenre.name });
        }
      });
    });
  });
  const uniqueTracks = matchedTracks.slice(0, 8);

  const hasResults = matchedGenres.length > 0 || uniqueTracks.length > 0;

  return (
    <div className="absolute top-full left-0 mt-2 w-full bg-[#1A1A1A] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 backdrop-blur-xl">
      {!hasResults && (
        <div className="px-4 py-3 text-sm text-white/40">검색 결과가 없습니다</div>
      )}

      {matchedGenres.length > 0 && (
        <div>
          <div className="px-4 pt-3 pb-1 text-[10px] text-white/30 font-mono tracking-widest uppercase">Genres</div>
          {matchedGenres.map(g => (
            <button
              key={g.id}
              onClick={() => { onSelectGenre(g); onClose(); }}
              className="w-full px-4 py-2.5 text-left text-sm text-white/80 hover:bg-white/5 hover:text-white transition-colors flex items-center gap-3"
            >
              <span className="w-2 h-2 rounded-full bg-[#E0F2FE] shrink-0" />
              {g.name}
            </button>
          ))}
        </div>
      )}

      {uniqueTracks.length > 0 && (
        <div>
          <div className="px-4 pt-3 pb-1 text-[10px] text-white/30 font-mono tracking-widest uppercase border-t border-white/5">Tracks</div>
          {uniqueTracks.map((item, i) => (
            <button
              key={`${item.track.track_id}-${i}`}
              onClick={() => { onSelectTrack(item.track, item.parentGenreName); onClose(); }}
              className="w-full px-4 py-2.5 text-left text-sm hover:bg-white/5 transition-colors flex items-center gap-3"
            >
              <span className="w-2 h-2 rounded-full bg-[#A7F3D0] shrink-0" />
              <div className="min-w-0">
                <div className="text-white/80 truncate">{item.track.name}</div>
                <div className="text-white/40 text-xs truncate">{item.track.artists}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
