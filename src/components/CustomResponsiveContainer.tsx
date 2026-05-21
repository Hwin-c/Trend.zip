import React, { useRef, useState, useEffect } from 'react';

interface CustomResponsiveContainerProps {
  children: (width: number, height: number) => React.ReactNode;
}

export const CustomResponsiveContainer: React.FC<CustomResponsiveContainerProps> = ({ children }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      
      // 소수점 픽셀 변동으로 인한 ResizeObserver 무한 루프 방지를 위해 정수형 스케일 사용
      const roundedWidth = Math.floor(width);
      const roundedHeight = Math.floor(height);

      setDimensions((prev) => {
        if (prev.width === roundedWidth && prev.height === roundedHeight) {
          return prev;
        }
        return { width: roundedWidth, height: roundedHeight };
      });
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full relative min-h-0 min-w-0 overflow-hidden">
      {dimensions.width > 0 && dimensions.height > 0 && children(dimensions.width, dimensions.height)}
    </div>
  );
};
