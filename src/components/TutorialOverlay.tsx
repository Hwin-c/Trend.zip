import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { GlassPanel } from './GlassPanel';

interface TutorialStep {
  title: string;
  selector: string;
  description: string;
  position: 'center' | 'right' | 'left' | 'top' | 'bottom';
}

interface TutorialOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  setMode: (mode: 'home' | 'explore') => void;
  setExploreTab: (tab: 'genre' | 'song') => void;
  allGenresMeta: any[];
  handleNodeClick: (node: any) => void;
  resetToHome: () => void;
}

export const TutorialOverlay: React.FC<TutorialOverlayProps> = ({ 
  isOpen, 
  onClose,
  setMode,
  setExploreTab,
  allGenresMeta,
  handleNodeClick,
  resetToHome
}) => {
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const resizeRef = useRef<number | null>(null);
  const nodeClickSimulatedRef = useRef<Record<number, boolean>>({});

  // 1. 튜토리얼이 다시 열릴 때 항상 1페이지(step 0)부터 시작하도록 초기화
  useEffect(() => {
    if (isOpen) {
      setStep(0);
      nodeClickSimulatedRef.current = {};
    }
  }, [isOpen]);

  // 콕핏 HUD 탐사를 위한 6단계 정교한 안내 시나리오 정의
  const steps: TutorialStep[] = [
    {
      title: "🌌 성단 음악 탐사선에 오신 것을 환영합니다!",
      selector: "", // 첫 단계는 전체 소개이므로 타깃 없음 (화면 정중앙 배치)
      description: "DBdigging 호의 튜토리얼 탐사에 오신 것을 축하합니다. 본 튜토리얼 가이드는 방대한 음악 장르와 노래 성단들을 6차원 오디오 특성을 기반으로 은하수 지도처럼 시각화하여 탐사할 수 있도록 설계된 콕핏 콘솔의 사용 가이드입니다.",
      position: 'center'
    },
    {
      title: "📋 좌측 탐사 제어반 (LEFT PANEL)",
      selector: ".left-panel-container",
      description: "현재 탐사 지역(대분류 장르, 세부 장르, 노래)의 요약 정보와 세부 리스트가 나타납니다. 상단의 '보기' 버튼과 정렬 토글(▲/▼)을 조작하여, 장르 평균 백분율이나 인기도를 기준으로 실시간 고속 정렬할 수 있습니다.",
      position: 'right'
    },
    {
      title: "✨ 중앙 별자리 성단 캔버스 (STAR CONSTELLATION)",
      selector: ".constellation-container",
      description: "별자리 지도를 드래그하여 은하계를 횡단하고, 마우스 휠로 줌인/줌아웃할 수 있습니다. 마음에 드는 장르나 노래(항성)를 클릭하면 우주선이 해당 성단으로 공간도약(Jump)을 하며, 세부 장르로의 딥다이브 탐험이 이루어집니다.",
      position: 'center'
    },
    {
      title: "🎨 우측 레이더 차트 & 테마 조율 패널 (RIGHT PANEL)",
      selector: ".right-panel-container",
      description: "현재 선택한 노래의 6차원 오디오 분석 레이더 차트가 실시간으로 수신됩니다. 하단의 HUD 제어 스킨 체인저를 통해 우주선 격벽의 RGB 조명 색상과 외장 패턴 텍스처를 원하는 감성으로 스왑/제작할 수 있습니다.",
      position: 'left'
    },
    {
      title: "🗺️ DIGGING LOG",
      selector: ".constellation-log-container",
      description: "우측 하단 'DIGGING LOG' 공간에 있는 비행 기록 일지 미니맵입니다! 사용자가 은하계를 탐색하며 지나온 성단들의 연결 궤적을 실시간으로 묘사합니다. 미니맵 상의 노드를 클릭하면 해당 위치로 즉각 공간도약(Warp Jump)합니다.",
      position: 'left'
    },
    {
      title: "🎵 SPOTIFY 연동 & 음악 스트리밍 제어기",
      selector: ".spotify-connect-header",
      description: "우측 상단의 'Connect to Spotify' 단추를 클릭해 Spotify 계정을 연동해 주세요! 실제 음악을 콕핏 전방 스피커로 직접 재생(Play/Pause)하고, 마음에 드는 곡을 내 보관함에 Like하거나 개인 Playlist에 바로 담을 수 있습니다.",
      position: 'bottom'
    }
  ];

  const currentStep = steps[step];

  // 2. Step 진행 상태에 따라 화면(모드) 및 성단 클릭 노드를 강제 자동 연동 전환해주는 스마트 콕핏 하이퍼 오토 파일럿
  useEffect(() => {
    if (!isOpen) return;

    if (step === 0) {
      // 1단계(웰컴)는 홈 화면으로 복귀 및 노드 선택 해제
      setMode('home');
      resetToHome();
    } else if (step === 1 || step === 2) {
      // 2단계(좌측), 3단계(중앙)는 탐색 모드 초기 상태 (선택된 노드 없음) 표출
      setMode('explore');
      setExploreTab('genre');
    } else if (step === 3) {
      // 4단계(우측 레이더)는 강제로 'A Cappella & Vocal' 대장르 노드를 선택 클릭 시뮬레이션
      setMode('explore');
      setExploreTab('genre');
      
      // 단 한 번만 시뮬레이션 클릭이 트리거되도록 안전 락 체결 (무한 업데이트 루프 및 D3 피직스 과열 완전 차단)
      if (!nodeClickSimulatedRef.current[step]) {
        nodeClickSimulatedRef.current[step] = true;
        
        const targetGenre = allGenresMeta.find(g => 
          g.name.toLowerCase().includes('a cappella') || 
          g.name.toLowerCase().includes('acapella')
        );
        if (targetGenre) {
          handleNodeClick({
            id: targetGenre.id,
            type: 'big_genre',
            name: targetGenre.name,
            audioFeatures: targetGenre.average_audio_features,
            x: 0,
            y: 0
          });
        }
      }
    } else {
      // 5단계(DIGGING LOG), 6단계(Spotify)는 탐색 모드 상태 유지
      setMode('explore');
    }
  }, [step, isOpen, setMode, setExploreTab, allGenresMeta, handleNodeClick, resetToHome]);

  const updateTargetPosition = () => {
    if (!currentStep.selector) {
      setTargetRect(null);
      return;
    }

    const element = document.querySelector(currentStep.selector);
    if (element) {
      const rect = element.getBoundingClientRect();
      // 유효한 크기가 획득되었을 때만 targetRect 갱신 (비동기 마운트 시 크기 0 상태 방어)
      if (rect.width > 0 && rect.height > 0) {
        setTargetRect(rect);
      }
    } else {
      setTargetRect(null);
    }
  };

  useLayoutEffect(() => {
    if (!isOpen) return;

    // 모드 전환 직후의 하이퍼드라이브 왜곡 트랜지션 시차(1.8초)를 부드럽게 감지하여
    // 최종 레이아웃 리플로우 정지 시점에 정확하게 자석 흡착시키기 위해 100ms 간격으로 총 25회 (2.5초간) 초정밀 돔 폴링 가동
    updateTargetPosition();
    
    let count = 0;
    const interval = setInterval(() => {
      updateTargetPosition();
      count++;
      if (count >= 25) {
        clearInterval(interval);
      }
    }, 100);

    const handleResize = () => {
      if (resizeRef.current) cancelAnimationFrame(resizeRef.current);
      resizeRef.current = requestAnimationFrame(() => {
        updateTargetPosition();
      });
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize);

    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize);
      if (resizeRef.current) cancelAnimationFrame(resizeRef.current);
    };
  }, [step, isOpen, currentStep.selector]);

  if (!isOpen) return null;

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(prev => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (step > 0) {
      setStep(prev => prev - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem('dbdigging_tutorial_completed', 'true');
    resetToHome(); // 완료 시 대칭적인 메인 홈 화면으로 자동 회항 복귀
    onClose();
  };

  // 3. 런타임 동적 Tailwind 임의 값 클래스는 정적 번들링에서 누락되므로 영구 제거.
  // 오직 웰컴/중앙 상태에 대한 정적 배치 클래스만 안전하게 반환.
  const getCardStyle = () => {
    if (!targetRect || currentStep.position === 'center') {
      return "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 max-w-md w-11/12";
    }
    return ""; // 그 외에는 React 인라인 스타일로 100% 위임
  };

  // 4. 카드의 absolute 픽셀 정밀 포지셔닝을 100% 인라인 스타일로 실시간 관찰 보정 위임
  const getCardInlineStyle = (): React.CSSProperties => {
    if (!targetRect || currentStep.position === 'center') return {};

    const padding = 20;
    const cardWidth = 360;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    if (currentStep.position === 'right') {
      const left = targetRect.right + padding;
      const top = Math.min(windowHeight - 300, Math.max(padding, targetRect.top + (targetRect.height / 2) - 100));
      return { position: 'absolute', left: `${left}px`, top: `${top}px`, width: `${cardWidth}px`, zIndex: 100 };
    }

    if (currentStep.position === 'left') {
      const left = targetRect.left - cardWidth - padding;
      const offsetTop = currentStep.selector === '.constellation-log-container' ? -120 : 0;
      const top = Math.min(windowHeight - 300, Math.max(padding, targetRect.top + (targetRect.height / 2) - 100 + offsetTop));
      return { position: 'absolute', left: `${left}px`, top: `${top}px`, width: `${cardWidth}px`, zIndex: 100 };
    }

    if (currentStep.position === 'bottom') {
      const left = Math.min(windowWidth - cardWidth - padding, Math.max(padding, targetRect.left + (targetRect.width / 2) - (cardWidth / 2)));
      const top = targetRect.bottom + padding;
      return { position: 'absolute', left: `${left}px`, top: `${top}px`, width: `${cardWidth}px`, zIndex: 100 };
    }

    if (currentStep.position === 'top') {
      const left = Math.min(windowWidth - cardWidth - padding, Math.max(padding, targetRect.left + (targetRect.width / 2) - (cardWidth / 2)));
      const bottom = windowHeight - targetRect.top + padding;
      return { position: 'absolute', left: `${left}px`, bottom: `${bottom}px`, width: `${cardWidth}px`, zIndex: 100 };
    }

    return {};
  };

  const maskX = targetRect ? targetRect.left - 8 : 0;
  const maskY = targetRect ? targetRect.top - 8 : 0;
  const maskWidth = targetRect ? targetRect.width + 16 : 0;
  const maskHeight = targetRect ? targetRect.height + 16 : 0;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden font-sans">
      <svg className="absolute inset-0 w-full h-full pointer-events-auto">
        <defs>
          <mask id="tutorial-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {targetRect && (
              <rect
                x={maskX}
                y={maskY}
                width={maskWidth}
                height={maskHeight}
                rx="14"
                ry="14"
                fill="black"
                className="transition-all duration-300"
              />
            )}
          </mask>
        </defs>

        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.78)"
          mask="url(#tutorial-mask)"
          className="pointer-events-auto"
        />

        {targetRect && (
          <rect
            x={maskX}
            y={maskY}
            width={maskWidth}
            height={maskHeight}
            rx="14"
            ry="14"
            fill="none"
            stroke="#00FFFF"
            strokeWidth="2"
            className="pointer-events-none transition-all duration-300 animate-pulse shadow-[0_0_15px_rgba(0,255,255,0.4)]"
            style={{
              filter: 'drop-shadow(0px 0px 8px rgba(0, 255, 255, 0.6))'
            }}
          />
        )}
      </svg>

      <GlassPanel
        className={`bg-black/90 border border-[#00FFFF]/30 rounded-2xl p-5 shadow-2xl flex flex-col justify-start transition-all duration-300 ${getCardStyle()}`}
        style={getCardInlineStyle()}
      >
        <div className="absolute inset-0 bg-[#00FFFF]/[0.01] pointer-events-none" />
        
        <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-[#00FFFF] to-transparent shadow-[0_0_10px_#00FFFF]" />
        
        <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-3 shrink-0">
          <span className="text-[10px] font-mono text-[#00FFFF] uppercase tracking-widest font-bold">
            HUD TUTORIAL GUIDE [STEP {step + 1}/{steps.length}]
          </span>
          <button
            onClick={() => {
              resetToHome(); // SKIP 클릭 시 메인 홈 화면으로 안전 회항 복귀
              onClose();
            }}
            className="text-xs font-mono text-white/30 hover:text-white cursor-pointer"
            title="도움말 닫기"
          >
            SKIP
          </button>
        </div>

        <h3 className="text-base font-bold text-white mb-2 leading-snug">
          {currentStep.title}
        </h3>

        <p className="text-xs text-white/70 leading-relaxed font-normal mb-5 flex-1 select-none whitespace-pre-line">
          {currentStep.description}
        </p>

        <div className="flex items-center justify-between border-t border-white/5 pt-3.5 mt-auto shrink-0">
          <div className="flex gap-1.5">
            {steps.map((_, idx) => (
              <span
                key={idx}
                className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                  idx === step 
                    ? 'bg-[#00FFFF] w-4 shadow-[0_0_8px_#00FFFF]' 
                    : 'bg-white/20'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                onClick={handlePrev}
                className="px-3 py-1.5 text-xs font-mono font-bold text-white/60 hover:text-white border border-white/10 rounded-lg hover:bg-white/5 cursor-pointer transition-all active:scale-95"
              >
                PREV
              </button>
            )}
            <button
              onClick={handleNext}
              className="px-4 py-1.5 text-xs font-mono font-bold text-black bg-[#00FFFF] hover:bg-[#00FFFF]/80 border border-[#00FFFF] rounded-lg shadow-[0_0_10px_rgba(0,255,255,0.3)] cursor-pointer transition-all active:scale-95 flex items-center gap-1"
            >
              <span>{step === steps.length - 1 ? 'LAUNCH' : 'NEXT'}</span>
              <span className="text-[10px]">▶</span>
            </button>
          </div>
        </div>

        {step === steps.length - 1 && (
          <button
            onClick={handleComplete}
            className="text-[9px] font-mono text-[#00FFFF]/50 hover:text-[#00FFFF] mt-3 mx-auto cursor-pointer transition-colors block text-center uppercase tracking-widest"
          >
            Don't show this tutorial again at launch
          </button>
        )}
      </GlassPanel>
    </div>
  );
};
