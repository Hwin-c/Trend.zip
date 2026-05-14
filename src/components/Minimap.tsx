import React, { useMemo } from 'react';
import { useDigging } from '../DiggingContext';
import { motion } from 'motion/react';
import { Trash2 } from 'lucide-react';

interface MinimapProps {
  onNavigate?: (nodeId: string) => void;
}

// Simple deterministic hash to generate consistent coordinates for minimap
const getHash = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
};

export const Minimap: React.FC<MinimapProps> = ({ onNavigate }) => {
  const { log, clearLog } = useDigging();

  const handleClear = () => {
    if (window.confirm('digging log(별자리)를 삭제하겠습니까?')) {
      clearLog();
    }
  };

  const pathNodes = useMemo(() => {
    return log.map((entry, index) => {
      // Use index and hash to create a deterministic but varied path
      const hash = Math.abs(getHash(entry.nodeId));
      // Base x on index to make it move forward generally, add some noise
      const x = Math.min(Math.max((index * 15 + (hash % 20)) % 80 + 10, 10), 90);
      // Randomize y somewhat deterministically
      const y = Math.min(Math.max((hash % 80) + 10, 10), 90);
      return { ...entry, x, y };
    });
  }, [log]);

  if (log.length === 0) {
    return <div className="w-48 h-20 flex items-center justify-center text-white/30 text-xs">No exploration log yet.</div>;
  }

  return (
    <div className="w-48 h-24 flex flex-col relative">
      <div className="absolute -top-10 right-0">
        <button 
          onClick={handleClear}
          className="text-white/30 hover:text-red-400 transition-colors"
          title="Clear Log"
        >
          <Trash2 size={14} />
        </button>
      </div>
      <div className="relative w-full flex-1 mt-2">
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
            onClick={() => onNavigate && onNavigate(node.nodeId)}
          >
            <div className="w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_5px_rgba(255,255,255,0.8)] group-hover:scale-150 transition-transform" />
            
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black/80 text-[10px] text-white whitespace-nowrap rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-white/10 z-50">
              {node.nodeName}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
