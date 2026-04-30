import React from 'react';
import { useDigging } from '../DiggingContext';
import { MOCK_NODES } from '../mockData';
import { motion } from 'motion/react';
import { Trash2 } from 'lucide-react';

export const Minimap: React.FC<{ onNavigate: (nodeId: string) => void }> = ({ onNavigate }) => {
  const { log, clearLog } = useDigging();

  if (log.length === 0) return null;

  // We need to map the log entries to their coordinates.
  // Since the minimap is small, we can just use the original x,y coordinates but scaled down.
  const pathNodes = log.map(entry => {
    const node = MOCK_NODES.find(n => n.id === entry.nodeId);
    return { ...entry, x: node?.x || 50, y: node?.y || 50 };
  });

  const handleClear = () => {
    if (window.confirm('digging log(별자리)를 삭제하겠습니까?')) {
      clearLog();
    }
  };

  return (
    <div className="fixed bottom-8 right-8 w-64 h-64 bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-4 z-50 flex flex-col">
      <div className="flex justify-between items-center mb-2">
        <div className="text-xs text-white/50 uppercase tracking-widest font-mono">Digging Log</div>
        <button 
          onClick={handleClear}
          className="text-white/30 hover:text-red-400 transition-colors"
          title="Clear Log"
        >
          <Trash2 size={14} />
        </button>
      </div>
      <div className="relative w-full flex-1">
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {pathNodes.map((node, i) => {
            if (i === 0) return null;
            const prev = pathNodes[i - 1];
            return (
              <motion.line
                key={`line-${node.id}-${i}`}
                x1={`${prev.x}%`}
                y1={`${prev.y}%`}
                x2={`${node.x}%`}
                y2={`${node.y}%`}
                stroke="rgba(255, 255, 255, 0.3)"
                strokeWidth="1"
                strokeDasharray="2 2"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.5 }}
              />
            );
          })}
        </svg>

        {pathNodes.map((node, i) => (
          <div
            key={`node-${node.id}-${i}`}
            className="absolute transform -translate-x-1/2 -translate-y-1/2 group cursor-pointer"
            style={{ left: `${node.x}%`, top: `${node.y}%` }}
            onClick={() => onNavigate(node.nodeId)}
          >
            <div className="w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_5px_rgba(255,255,255,0.8)] group-hover:scale-150 transition-transform" />
            
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black/80 text-[10px] text-white whitespace-nowrap rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-white/10">
              {node.nodeName} ({node.nodeType.replace('_', ' ')})
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
