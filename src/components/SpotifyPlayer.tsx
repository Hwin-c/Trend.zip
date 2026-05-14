import React from 'react';

interface SpotifyPlayerProps {
  trackId: string;
}

export const SpotifyPlayer: React.FC<SpotifyPlayerProps> = ({ trackId }) => {
  if (!trackId) return null;

  return (
    <div className="w-full rounded-xl overflow-hidden border border-white/10">
      <iframe
        src={`https://open.spotify.com/embed/track/${trackId}?theme=0&utm_source=generator`}
        width="100%"
        height="80"
        frameBorder="0"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
        style={{ borderRadius: '12px' }}
      />
    </div>
  );
};
