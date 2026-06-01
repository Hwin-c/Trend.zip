import React from 'react';
import { motion } from 'motion/react';

interface CockpitFrameProps {
  headerSlot: React.ReactNode;
  leftPanelSlot: React.ReactNode;
  centerSlot: React.ReactNode;
  rightPanelSlot: React.ReactNode;
  footerSlot: React.ReactNode;
  isLightHull: boolean;
  getHullStyle: (gridStyles: React.CSSProperties) => React.CSSProperties;
}

export const CockpitFrame: React.FC<CockpitFrameProps> = ({
  headerSlot,
  leftPanelSlot,
  centerSlot,
  rightPanelSlot,
  footerSlot,
  isLightHull,
  getHullStyle
}) => {
  return (
    <div 
      className="w-screen h-screen bg-[#050505] text-white overflow-hidden font-sans selection:bg-[#B026FF]/30 grid relative box-border transition-all duration-500"
      style={{
        gridTemplateColumns: '380px 1fr 320px',
        gridTemplateRows: '80px 1fr 80px',
      }}
    >
      {/* Row 1: Top HUD & Header */}
      <motion.header 
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 80, damping: 15, delay: 0.1 }}
        className={`relative z-30 flex items-center justify-between px-8 box-border select-none border-b border-white/10 transition-colors duration-500 ${isLightHull ? 'hull-tint-light' : ''}`}
        style={getHullStyle({
          gridRow: '1',
          gridColumn: '1 / span 3',
        })}
      >
        {headerSlot}
      </motion.header>

      {/* Row 2, Column 1: Left Panel Zone */}
      <motion.div 
        initial={{ x: -380, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 70, damping: 14 }}
        className={`relative flex flex-col justify-start min-h-0 border-r border-white/10 transition-colors duration-500 shadow-[inset_-20px_0_30px_rgba(0,0,0,0.5)] ${isLightHull ? 'hull-tint-light' : ''}`}
        style={getHullStyle({
          gridRow: '2',
          gridColumn: '1',
          padding: '12px',
        })}
      >
        {leftPanelSlot}
      </motion.div>

      {/* Row 2, Column 2: Center Space Window */}
      <div 
        className="relative h-full overflow-hidden min-h-0 flex items-center justify-center transition-all duration-500 border-x border-[#00FFFF]/10 shadow-[0_0_50px_rgba(0,0,0,0.9)_inset]"
        style={{
          gridRow: '2',
          gridColumn: '2',
        }}
      >
        {centerSlot}
      </div>

      {/* Row 2, Column 3: Right Panel Zone */}
      <motion.div 
        initial={{ x: 320, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 70, damping: 14 }}
        className={`relative flex flex-col justify-between gap-y-3 min-h-0 border-l border-white/10 transition-colors duration-500 shadow-[inset_20px_0_30px_rgba(0,0,0,0.5)] ${isLightHull ? 'hull-tint-light' : ''}`}
        style={getHullStyle({
          gridRow: '2',
          gridColumn: '3',
          padding: '12px',
        })}
      >
        {rightPanelSlot}
      </motion.div>

      {/* Row 3: Bottom Console Frame */}
      <motion.footer 
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 70, damping: 14, delay: 0.15 }}
        className={`relative z-20 select-none border-t border-white/10 transition-colors duration-500 ${isLightHull ? 'hull-tint-light' : ''}`}
        style={getHullStyle({
          gridRow: '3',
          gridColumn: '1 / span 3',
        })}
      >
        {footerSlot}
      </motion.footer>
    </div>
  );
};
