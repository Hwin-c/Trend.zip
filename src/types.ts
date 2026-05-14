export type NodeType = 'big_genre' | 'sub_genre' | 'song' | 'artist' | 'album' | 'spaceship';

export interface AudioFeatures {
  energy?: number;
  danceability?: number;
  valence?: number;
  speechiness?: number;
  acousticness?: number;
  instrumentalness?: number;
  tempo?: number;
  liveness?: number;
  [key: string]: number | undefined;
}

export interface TrackSnapshot {
  track_id: string;
  name: string;
  artists: string;
  energy?: number;
  danceability?: number;
  valence?: number;
  features?: AudioFeatures;
  album_cover?: string;
  spotify_uri?: string; // 'spotify:track:{id}' format
}

export interface Track {
  track_id: string;
  name: string;
  artists: string;
  Genre_List: string[];
  Parent_Genre_List: string[];
  audio_features: AudioFeatures;
  energy_level: 'High' | 'Mid' | 'Low';
  dance_level: 'High' | 'Mid' | 'Low';
  popularity_score: number;
}

export interface ParentGenre {
  id: string;
  level: number;
  name: string;
  average_audio_features: AudioFeatures;
  top_tracks: TrackSnapshot[];
  sub_genres_data?: SubGenre[];
}

export interface SubGenre {
  id: string;
  level?: number;
  name: string;
  parent_genre?: string;
  average_audio_features: AudioFeatures;
  // Note: actual DB sub_genres_data does NOT contain top_tracks.
  // Tracks for a sub-genre must be queried from 'tracks' collection.
}

export interface HomeTrendingMetadata {
  id: string;
  last_updated?: string;
  trending_tracks: TrackSnapshot[];
}

export interface AllGenresMetadata {
  id: string;
  genres: Pick<ParentGenre, 'id' | 'name' | 'average_audio_features'>[];
}

export interface NodeData {
  id: string;
  type: NodeType;
  name: string;
  x: number; // 0 to 100 (percentage)
  y: number; // 0 to 100 (percentage)

  // Custom payloads based on type
  audioFeatures?: AudioFeatures;
  childrenGenres?: string[];
  parentGenre?: string;
  topTracks?: TrackSnapshot[];
  trackSnapshot?: TrackSnapshot;
  artistName?: string;
  albumName?: string;
}

export interface DiggingLogEntry {
  id: string;
  nodeId: string;
  nodeName: string;
  nodeType: NodeType;
  timestamp: number;
}
