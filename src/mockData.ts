import { NodeData } from './types';

export const MOCK_NODES: NodeData[] = [
  // --- Big Genres ---
  { id: 'bg1', type: 'big_genre', name: 'Pop', x: 20, y: 30 },
  { id: 'bg2', type: 'big_genre', name: 'Rock', x: 50, y: 20 },
  { id: 'bg3', type: 'big_genre', name: 'Hip Hop', x: 80, y: 40 },
  { id: 'bg4', type: 'big_genre', name: 'Electronic', x: 30, y: 70 },
  { id: 'bg5', type: 'big_genre', name: 'Jazz', x: 70, y: 80 },

  // --- Sub Genres (Pop) ---
  { id: 'sg1', type: 'sub_genre', name: 'Synthpop', parentId: 'bg1', x: 30, y: 20 },
  { id: 'sg2', type: 'sub_genre', name: 'K-Pop', parentId: 'bg1', x: 50, y: 50 },
  { id: 'sg3', type: 'sub_genre', name: 'Indie Pop', parentId: 'bg1', x: 20, y: 70 },

  // --- Sub Genres (Rock) ---
  { id: 'sg4', type: 'sub_genre', name: 'Alternative', parentId: 'bg2', x: 40, y: 30 },
  { id: 'sg5', type: 'sub_genre', name: 'Metal', parentId: 'bg2', x: 70, y: 40 },

  // --- Artists (K-Pop) ---
  { id: 'a1', type: 'artist', name: 'NewJeans', parentId: 'sg2', genreId: 'sg2', x: 30, y: 40, relatedIds: ['a2', 'a3'] },
  { id: 'a2', type: 'artist', name: 'BTS', parentId: 'sg2', genreId: 'sg2', x: 60, y: 30, relatedIds: ['a1'] },
  { id: 'a3', type: 'artist', name: 'aespa', parentId: 'sg2', genreId: 'sg2', x: 50, y: 70, relatedIds: ['a1'] },

  // --- Artists (Synthpop) ---
  { id: 'a4', type: 'artist', name: 'The Weeknd', parentId: 'sg1', genreId: 'sg1', x: 40, y: 40, relatedIds: [] },
  { id: 'a5', type: 'artist', name: 'Dua Lipa', parentId: 'sg1', genreId: 'sg1', x: 70, y: 60, relatedIds: ['a4'] },

  // --- Songs (NewJeans) ---
  { id: 's1', type: 'song', name: 'Ditto', parentId: 'sg2', artistId: 'a1', genreId: 'sg2', x: 40, y: 30, relatedIds: ['s2', 's3'] },
  { id: 's2', type: 'song', name: 'Hype Boy', parentId: 'sg2', artistId: 'a1', genreId: 'sg2', x: 60, y: 50, relatedIds: ['s1', 's3'] },
  { id: 's3', type: 'song', name: 'OMG', parentId: 'sg2', artistId: 'a1', genreId: 'sg2', x: 30, y: 70, relatedIds: ['s1', 's2'] },
  
  // --- Songs (BTS) ---
  { id: 's4', type: 'song', name: 'Dynamite', parentId: 'sg2', artistId: 'a2', genreId: 'sg2', x: 70, y: 20, relatedIds: ['s5'] },
  { id: 's5', type: 'song', name: 'Butter', parentId: 'sg2', artistId: 'a2', genreId: 'sg2', x: 80, y: 60, relatedIds: ['s4'] },

  // --- Songs (The Weeknd) ---
  { id: 's6', type: 'song', name: 'Blinding Lights', parentId: 'sg1', artistId: 'a4', genreId: 'sg1', x: 50, y: 50, relatedIds: ['s7'] },
  { id: 's7', type: 'song', name: 'Save Your Tears', parentId: 'sg1', artistId: 'a4', genreId: 'sg1', x: 30, y: 30, relatedIds: ['s6'] },
];

export const getNodeById = (id: string) => MOCK_NODES.find(n => n.id === id);
export const getNodesByType = (type: NodeType) => MOCK_NODES.filter(n => n.type === type);
export const getNodesByParent = (parentId: string, type?: NodeType) => 
  MOCK_NODES.filter(n => n.parentId === parentId && (!type || n.type === type));
export const getSongsByArtist = (artistId: string) => MOCK_NODES.filter(n => n.type === 'song' && n.artistId === artistId);
