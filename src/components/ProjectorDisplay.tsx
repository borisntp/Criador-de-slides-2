import React, { useState, useEffect } from 'react';
import { SlideItem, SlideSettings } from '../types';
import { SlideCanvas } from './SlideCanvas';
import { ProjectorBroadcaster, ProjectorSyncMessage } from '../utils/projectorSync';

interface ProjectorDisplayProps {
  initialSlides?: SlideItem[];
  initialSettings?: SlideSettings;
}

export const ProjectorDisplay: React.FC<ProjectorDisplayProps> = () => {
  const [slides, setSlides] = useState<SlideItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isBlackout, setIsBlackout] = useState(false);
  const [settings, setSettings] = useState<SlideSettings>({
    fontSizePt: 54,
    lineHeight: 1.22,
    textTransform: 'uppercase',
    textAlign: 'center',
    aspectRatio: '16:9',
    theme: 'black',
    fontFamily: 'arial-black',
    safeMarginPercent: 6,
    splitMode: 'paragraph',
    maxLinesPerSlide: 6,
    addCommasToPhrases: true,
    autoFitMaxSpace: true,
  });

  useEffect(() => {
    // 1. Read existing state from localStorage if available
    try {
      const stored = localStorage.getItem('letras_projetor_state');
      if (stored) {
        const parsed: ProjectorSyncMessage = JSON.parse(stored);
        if (parsed.slides) setSlides(parsed.slides);
        if (parsed.settings) setSettings(parsed.settings);
        if (typeof parsed.currentIndex === 'number') setCurrentIndex(parsed.currentIndex);
        if (typeof parsed.isBlackout === 'boolean') setIsBlackout(parsed.isBlackout);
      }
    } catch {}

    // 2. Listen to broadcast messages from main operator window
    const broadcaster = new ProjectorBroadcaster();
    const cleanup = broadcaster.onMessage(msg => {
      if (msg.type === 'SLIDE_CHANGE' && typeof msg.currentIndex === 'number') {
        setCurrentIndex(msg.currentIndex);
      } else if (msg.type === 'DATA_UPDATE') {
        if (msg.slides) setSlides(msg.slides);
        if (msg.settings) setSettings(msg.settings);
        if (typeof msg.currentIndex === 'number') setCurrentIndex(msg.currentIndex);
      } else if (msg.type === 'BLACKOUT_TOGGLE' && typeof msg.isBlackout === 'boolean') {
        setIsBlackout(msg.isBlackout);
      }
    });

    return () => {
      cleanup?.();
      broadcaster.close();
    };
  }, []);

  // Keyboard navigation directly on the projector screen if focused
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowRight', 'ArrowDown', ' ', 'PageDown'].includes(e.key)) {
        setCurrentIndex(prev => Math.min(prev + 1, slides.length - 1));
      } else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) {
        setCurrentIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'b' || e.key === 'B') {
        setIsBlackout(b => !b);
      } else if (e.key === 'f' || e.key === 'F') {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [slides.length]);

  const currentSlide = slides[currentIndex] || slides[0];

  return (
    <div
      className="fixed inset-0 w-screen h-screen bg-black overflow-hidden flex items-center justify-center select-none"
      onDoubleClick={() => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      }}
    >
      {isBlackout ? (
        <div className="w-full h-full bg-black" />
      ) : currentSlide ? (
        <SlideCanvas
          slide={currentSlide}
          settings={settings}
          isPresentationMode={true}
          className="w-full h-full"
        />
      ) : (
        <div className="text-neutral-600 font-mono text-sm text-center px-4">
          Aguardando música da tela principal...
        </div>
      )}
    </div>
  );
};
