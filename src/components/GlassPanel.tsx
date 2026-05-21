import React from 'react';

interface GlassPanelProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const GlassPanel: React.FC<GlassPanelProps> = ({ children, className = '', style }) => {
  return (
    <div 
      className={`relative rounded-xl overflow-hidden flex flex-col border border-[rgba(0,255,255,0.4)] bg-[rgba(15,23,42,0.4)] backdrop-blur-[12px] shadow-[0_0_15px_rgba(0,255,255,0.15),inset_0_0_15px_rgba(0,255,255,0.1)] transition-all duration-300 ${className}`}
      style={style}
    >
      {/* Mac-style Window Button Bar (Header Decorator) */}
      <div className="h-[30px] min-h-[30px] flex items-center gap-[6px] px-3 shrink-0 border-b border-white/5 bg-white/[0.02] select-none">
        <div className="w-[12px] h-[12px] rounded-full bg-[#FF5F56] transition-transform active:scale-90" />
        <div className="w-[12px] h-[12px] rounded-full bg-[#FFBD2E] transition-transform active:scale-90" />
        <div className="w-[12px] h-[12px] rounded-full bg-[#27C93F] transition-transform active:scale-90" />
      </div>
      
      {/* Dynamic Content Area */}
      <div className="flex-1 min-h-0 flex flex-col">
        {children}
      </div>
    </div>
  );
};
