export type NodeType = 'big_genre' | 'sub_genre' | 'song' | 'artist';

export interface NodeData {
  id: string;
  type: NodeType;
  name: string;
  x: number; // 0 to 100 (percentage)
  y: number; // 0 to 100 (percentage)
  parentId?: string; // For hierarchical navigation
  artistId?: string; // For songs
  genreId?: string; // For songs/artists
  relatedIds?: string[]; // For related songs/artists
}

export interface DiggingLogEntry {
  id: string;
  nodeId: string;
  nodeName: string;
  nodeType: NodeType;
  timestamp: number;
}
