import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { NodeData } from '../types';
import { cn } from '../lib/utils';

interface ConstellationProps {
  nodes: NodeData[];
  centerNode?: NodeData;
  onNodeClick: (node: NodeData) => void;
  activeNodeId?: string;
}

export const Constellation: React.FC<ConstellationProps> = ({ nodes, centerNode, onNodeClick, activeNodeId }) => {
  // Generate lines between nodes
  const lines = useMemo(() => {
    const result = [];
    if (centerNode) {
      // Connect all nodes to center
      for (const node of nodes) {
        if (node.id !== centerNode.id) {
          result.push({ x1: centerNode.x, y1: centerNode.y, x2: node.x, y2: node.y, id: `${centerNode.id}-${node.id}` });
        }
      }
    } else {
      // Connect nodes sequentially to form a constellation shape
      for (let i = 0; i < nodes.length - 1; i++) {
        result.push({
          x1: nodes[i].x,
          y1: nodes[i].y,
          x2: nodes[i + 1].x,
          y2: nodes[i + 1].y,
          id: `${nodes[i].id}-${nodes[i + 1].id}`
        });
      }
      // Connect last to first if more than 2 nodes
      if (nodes.length > 2) {
        result.push({
          x1: nodes[nodes.length - 1].x,
          y1: nodes[nodes.length - 1].y,
          x2: nodes[0].x,
          y2: nodes[0].y,
          id: `${nodes[nodes.length - 1].id}-${nodes[0].id}`
        });
      }
    }
    return result;
  }, [nodes, centerNode]);

  const allNodes = centerNode ? [...nodes.filter(n => n.id !== centerNode.id), centerNode] : nodes;

  return (
    <div className="relative w-full h-full min-h-[500px]">
      {/* SVG for lines */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        {lines.map((line, i) => (
          <motion.line
            key={line.id}
            x1={`${line.x1}%`}
            y1={`${line.y1}%`}
            x2={`${line.x2}%`}
            y2={`${line.y2}%`}
            stroke="rgba(255, 255, 255, 0.2)"
            strokeWidth="2"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1, delay: i * 0.1 }}
          />
        ))}
      </svg>

      {/* Stars (Nodes) */}
      {allNodes.map((node, i) => {
        const isCenter = centerNode && node.id === centerNode.id;
        const isActive = activeNodeId === node.id;
        
        return (
          <motion.div
            key={node.id}
            className="absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center cursor-pointer group"
            style={{ left: `${node.x}%`, top: `${node.y}%` }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
            onClick={() => onNodeClick(node)}
          >
            {/* Star glow */}
            <div className={cn(
              "absolute rounded-full blur-md transition-all duration-300",
              isCenter ? "w-16 h-16 bg-white/20" : "w-8 h-8 bg-white/10 group-hover:bg-white/30",
              isActive && "bg-blue-400/40"
            )} />
            
            {/* Star core */}
            <div className={cn(
              "relative rounded-full bg-white shadow-[0_0_15px_rgba(255,255,255,0.8)] transition-all duration-300",
              isCenter ? "w-4 h-4" : "w-2 h-2 group-hover:w-3 group-hover:h-3",
              isActive && "bg-blue-200 shadow-[0_0_20px_rgba(96,165,250,0.8)]"
            )} />
            
            {/* Label */}
            <div className={cn(
              "absolute top-full mt-3 whitespace-nowrap text-sm font-medium tracking-wider transition-all duration-300",
              isCenter ? "text-white text-lg" : "text-white/70 group-hover:text-white",
              isActive && "text-blue-200"
            )}>
              {node.name}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};
