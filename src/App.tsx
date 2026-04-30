import React, { useState, useEffect } from 'react';
import { Constellation } from './components/Constellation';
import { Minimap } from './components/Minimap';
import { DiggingProvider, useDigging } from './DiggingContext';
import { MOCK_NODES, getNodesByType, getNodesByParent, getNodeById, getSongsByArtist } from './mockData';
import { NodeData, NodeType } from './types';
import { motion, AnimatePresence } from 'motion/react';
import { getLogsFromFirestore } from './lib/firebase';

function AdminDashboard({ onClose }: { onClose: () => void }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLogsFromFirestore().then(data => {
      setLogs(data);
      setLoading(false);
    });
  }, []);

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-8 backdrop-blur-sm">
      <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-4xl max-h-[80vh] flex flex-col overflow-hidden">
        <div className="p-6 border-b border-white/10 flex justify-between items-center">
          <h2 className="text-2xl font-serif">Admin Dashboard</h2>
          <button onClick={onClose} className="text-white/50 hover:text-white">Close</button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">
          <h3 className="text-lg mb-4 text-white/70">Recent Digging Logs</h3>
          {loading ? (
            <div className="text-white/50">Loading...</div>
          ) : logs.length === 0 ? (
            <div className="text-white/50">No logs found.</div>
          ) : (
            <div className="space-y-4">
              {logs.map(log => (
                <div key={log.id} className="bg-white/5 p-4 rounded-lg border border-white/5">
                  <div className="flex justify-between text-sm text-white/50 mb-2">
                    <span>User: {log.userId}</span>
                    <span>{new Date(log.createdAt?.seconds ? log.createdAt.seconds * 1000 : log.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {log.log?.map((entry: any, i: number) => (
                      <span key={i} className="text-xs bg-white/10 px-2 py-1 rounded">
                        {entry.nodeName} ({entry.nodeType})
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LogThumbnail({ logEntries }: { logEntries: any[] }) {
  const pathNodes = logEntries.map(entry => {
    const node = MOCK_NODES.find(n => n.id === entry.nodeId);
    return { ...entry, x: node?.x || 50, y: node?.y || 50 };
  });

  return (
    <div className="relative w-full aspect-square bg-black/50 rounded-lg overflow-hidden border border-white/10">
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        {pathNodes.map((node, i) => {
          if (i === 0) return null;
          const prev = pathNodes[i - 1];
          return (
            <line
              key={`line-${i}`}
              x1={`${prev.x}%`}
              y1={`${prev.y}%`}
              x2={`${node.x}%`}
              y2={`${node.y}%`}
              stroke="rgba(255, 255, 255, 0.4)"
              strokeWidth="2"
            />
          );
        })}
        {pathNodes.map((node, i) => (
          <circle
            key={`circle-${i}`}
            cx={`${node.x}%`}
            cy={`${node.y}%`}
            r="3"
            fill="white"
          />
        ))}
      </svg>
    </div>
  );
}

function MyLogsModal({ onClose }: { onClose: () => void }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useDigging();

  useEffect(() => {
    if (user) {
      getLogsFromFirestore(user.uid).then(data => {
        setLogs(data);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, [user]);

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-8 backdrop-blur-sm">
      <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-5xl max-h-[80vh] flex flex-col overflow-hidden">
        <div className="p-6 border-b border-white/10 flex justify-between items-center">
          <h2 className="text-2xl font-serif">My Constellations (Logs)</h2>
          <button onClick={onClose} className="text-white/50 hover:text-white">Close</button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">
          <p className="text-white/50 mb-6 text-sm">Your digging logs are saved as constellation images. They will automatically disappear after 30 days.</p>
          {loading ? (
            <div className="text-white/50">Loading...</div>
          ) : logs.length === 0 ? (
            <div className="text-white/50">No logs found. Start digging and save your journey!</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {logs.map(log => {
                const createdAt = log.createdAt?.seconds ? new Date(log.createdAt.seconds * 1000) : new Date(log.createdAt);
                const expiresAt = log.expiresAt?.seconds ? new Date(log.expiresAt.seconds * 1000) : new Date(log.expiresAt);
                const daysLeft = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                
                return (
                  <div key={log.id} className="bg-white/5 p-4 rounded-xl border border-white/10 flex flex-col">
                    <LogThumbnail logEntries={log.log} />
                    <div className="mt-4">
                      <div className="text-sm font-medium text-white">{createdAt.toLocaleDateString()}</div>
                      <div className="text-xs text-white/50 mt-1">{log.log.length} stars connected</div>
                      <div className="text-xs text-orange-400/80 mt-2">Expires in {daysLeft} days</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MainApp() {
  const [currentTab, setCurrentTab] = useState<'genre' | 'artist'>('genre');
  const [currentNode, setCurrentNode] = useState<NodeData | null>(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showMyLogs, setShowMyLogs] = useState(false);
  const { addToLog, user, login, logout, saveLog } = useDigging();

  const handleNodeClick = (node: NodeData, forceTab?: 'genre' | 'artist') => {
    addToLog(node.id, node.name, node.type);
    
    if (forceTab) {
      setCurrentTab(forceTab);
    } else if (node.type === 'artist') {
      setCurrentTab('artist');
    } else if (node.type === 'song') {
      setCurrentTab('genre');
    }
    
    setCurrentNode(node);
  };

  const handleNavigateLog = (nodeId: string) => {
    const node = getNodeById(nodeId);
    if (node) {
      if (node.type === 'artist') setCurrentTab('artist');
      if (node.type === 'song') setCurrentTab('genre');
      setCurrentNode(node);
    }
  };

  const resetToRoot = (tab: 'genre' | 'artist') => {
    setCurrentTab(tab);
    setCurrentNode(null);
  };

  let displayNodes: NodeData[] = [];
  let centerNode: NodeData | undefined = undefined;
  let detailPanel = null;

  if (!currentNode) {
    displayNodes = getNodesByType('big_genre');
  } else if (currentNode.type === 'big_genre') {
    centerNode = currentNode;
    displayNodes = getNodesByParent(currentNode.id, 'sub_genre');
  } else if (currentNode.type === 'sub_genre') {
    centerNode = currentNode;
    displayNodes = getNodesByParent(currentNode.id, currentTab === 'genre' ? 'song' : 'artist');
  } else if (currentNode.type === 'song') {
    centerNode = currentNode;
    displayNodes = currentNode.relatedIds?.map(id => getNodeById(id)).filter(Boolean) as NodeData[] || [];
    
    const artist = currentNode.artistId ? getNodeById(currentNode.artistId) : null;
    const genre = currentNode.genreId ? getNodeById(currentNode.genreId) : null;

    detailPanel = (
      <div className="absolute top-32 left-12 w-80 bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 text-white z-20">
        <h2 className="text-3xl font-serif mb-2">{currentNode.name}</h2>
        <div className="space-y-4 mt-6">
          <div>
            <div className="text-xs text-white/50 uppercase tracking-widest mb-1">Artist</div>
            <button 
              onClick={() => artist && handleNodeClick(artist, 'artist')}
              className="text-lg hover:text-blue-400 transition-colors"
            >
              {artist?.name || 'Unknown'}
            </button>
          </div>
          <div>
            <div className="text-xs text-white/50 uppercase tracking-widest mb-1">Genre</div>
            <button 
              onClick={() => genre && handleNodeClick(genre, 'genre')}
              className="text-lg hover:text-blue-400 transition-colors"
            >
              {genre?.name || 'Unknown'}
            </button>
          </div>
        </div>
        <div className="mt-8 pt-6 border-t border-white/10">
          <div className="text-xs text-white/50 uppercase tracking-widest mb-3">Related Recommendations</div>
          <div className="text-sm text-white/70">Explore the connected stars to discover similar tracks.</div>
        </div>
      </div>
    );
  } else if (currentNode.type === 'artist') {
    centerNode = currentNode;
    displayNodes = currentNode.relatedIds?.map(id => getNodeById(id)).filter(Boolean) as NodeData[] || [];
    
    const genre = currentNode.genreId ? getNodeById(currentNode.genreId) : null;
    const topSongs = getSongsByArtist(currentNode.id);

    detailPanel = (
      <div className="absolute top-32 left-12 w-80 bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 text-white z-20">
        <h2 className="text-3xl font-serif mb-2">{currentNode.name}</h2>
        <div className="space-y-4 mt-6">
          <div>
            <div className="text-xs text-white/50 uppercase tracking-widest mb-1">Primary Genre</div>
            <button 
              onClick={() => genre && handleNodeClick(genre, 'genre')}
              className="text-lg hover:text-blue-400 transition-colors"
            >
              {genre?.name || 'Unknown'}
            </button>
          </div>
          <div className="pt-4">
            <div className="text-xs text-white/50 uppercase tracking-widest mb-3">Top Tracks</div>
            <ul className="space-y-2">
              {topSongs.map(song => (
                <li key={song.id}>
                  <button 
                    onClick={() => handleNodeClick(song, 'genre')}
                    className="text-sm hover:text-blue-400 transition-colors text-left"
                  >
                    • {song.name}
                  </button>
                </li>
              ))}
              {topSongs.length === 0 && <li className="text-sm text-white/50">No tracks available</li>}
            </ul>
          </div>
        </div>
        <div className="mt-8 pt-6 border-t border-white/10">
          <div className="text-xs text-white/50 uppercase tracking-widest mb-3">Related Artists</div>
          <div className="text-sm text-white/70">Explore the connected stars to discover similar artists.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white overflow-hidden font-sans selection:bg-white/30">
      {/* Atmospheric Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_#1a1a2e_0%,_#050505_100%)] opacity-80" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30 mix-blend-screen" />
      </div>

      {/* Header Navigation */}
      <header className="relative z-20 flex items-center justify-between px-8 py-6 border-b border-white/10 bg-black/20 backdrop-blur-md">
        <div className="flex items-center gap-8">
          <h1 className="text-xl font-serif tracking-widest uppercase cursor-pointer" onClick={() => resetToRoot('genre')}>
            DB<span className="text-white/50">digging</span>
          </h1>
          <nav className="flex items-center gap-4 bg-white/5 rounded-full p-1 border border-white/10">
            <button
              onClick={() => resetToRoot('genre')}
              className={`px-6 py-2 rounded-full text-sm font-medium tracking-wider uppercase transition-all ${
                currentTab === 'genre' ? 'bg-white text-black' : 'text-white/70 hover:text-white'
              }`}
            >
              Genre
            </button>
            <button
              onClick={() => resetToRoot('artist')}
              className={`px-6 py-2 rounded-full text-sm font-medium tracking-wider uppercase transition-all ${
                currentTab === 'artist' ? 'bg-white text-black' : 'text-white/70 hover:text-white'
              }`}
            >
              Artist
            </button>
          </nav>
        </div>
        
        <div className="flex items-center gap-6">
          {/* Breadcrumb / Current Path */}
          <div className="hidden md:flex items-center gap-2 text-sm text-white/50 font-mono">
            <button onClick={() => resetToRoot(currentTab)} className="hover:text-white transition-colors">ROOT</button>
            {currentNode && (
              <>
                <span>/</span>
                <span className="text-white">{currentNode.name}</span>
              </>
            )}
          </div>

          {/* Auth & Actions */}
          <div className="flex items-center gap-4 text-sm font-mono border-l border-white/10 pl-6">
            {user ? (
              <>
                <span className="text-white/50">{user.displayName || user.email}</span>
                <button onClick={saveLog} className="hover:text-blue-400 transition-colors">Save Log</button>
                <button onClick={() => setShowMyLogs(true)} className="hover:text-green-400 transition-colors">My Logs</button>
                <button onClick={() => setShowAdmin(true)} className="hover:text-purple-400 transition-colors">Admin</button>
                <button onClick={logout} className="hover:text-red-400 transition-colors">Logout</button>
              </>
            ) : (
              <button onClick={login} className="hover:text-white transition-colors text-white/70">Login</button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative w-full h-[calc(100vh-85px)] z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentNode?.id || 'root'}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0"
          >
            <Constellation 
              nodes={displayNodes} 
              centerNode={centerNode} 
              onNodeClick={handleNodeClick}
              activeNodeId={currentNode?.id}
            />
            {detailPanel}
          </motion.div>
        </AnimatePresence>
      </main>

      <Minimap onNavigate={handleNavigateLog} />

      {showAdmin && <AdminDashboard onClose={() => setShowAdmin(false)} />}
      {showMyLogs && <MyLogsModal onClose={() => setShowMyLogs(false)} />}
    </div>
  );
}

export default function App() {
  return (
    <DiggingProvider>
      <MainApp />
    </DiggingProvider>
  );
}
