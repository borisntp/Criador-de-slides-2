import React, { useState, useEffect, useCallback } from 'react';
import { SlideItem, SlideSettings } from '../types';
import { SlideCanvas } from './SlideCanvas';

interface PresentationModalProps {
  slides: SlideItem[];
  settings: SlideSettings;
  initialSlideIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onSlideChange?: (index: number) => void;
}

export const PresentationModal: React.FC<PresentationModalProps> = ({
  slides,
  settings,
  initialSlideIndex,
  isOpen,
  onClose,
  onSlideChange,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialSlideIndex);
  const [isBlackout, setIsBlackout] = useState(false);
  const [showControls, setShowControls] = useState(true);

  // Sync initial slide index
  useEffect(() => {
    setCurrentIndex(initialSlideIndex);
  }, [initialSlideIndex, isOpen]);

  // Request browser fullscreen when opening presentation mode
  useEffect(() => {
    if (isOpen) {
      const el = document.documentElement;
      if (el.requestFullscreen && !document.fullscreenElement) {
        el.requestFullscreen().catch(() => {
          // Fullscreen might be blocked by browser policy without direct user gesture
        });
      }
    } else {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  }, [isOpen]);

  // Fade out floating controls after 2.5 seconds of inactivity
  useEffect(() => {
    if (!isOpen) return;
    setShowControls(true);
    const timeout = setTimeout(() => {
      setShowControls(false);
    }, 2800);

    const handleMouseMove = () => {
      setShowControls(true);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [isOpen, currentIndex, isBlackout]);

  const goToNext = useCallback(() => {
    if (currentIndex < slides.length - 1) {
      const next = currentIndex + 1;
      setCurrentIndex(next);
      onSlideChange?.(next);
    }
  }, [currentIndex, slides.length, onSlideChange]);

  const goToPrev = useCallback(() => {
    if (currentIndex > 0) {
      const prev = currentIndex - 1;
      setCurrentIndex(prev);
      onSlideChange?.(prev);
    }
  }, [currentIndex, onSlideChange]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case ' ':
        case 'PageDown':
        case 'Enter':
          e.preventDefault();
          goToNext();
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'PageUp':
        case 'Backspace':
          e.preventDefault();
          goToPrev();
          break;
        case 'Home':
          e.preventDefault();
          setCurrentIndex(0);
          onSlideChange?.(0);
          break;
        case 'End':
          e.preventDefault();
          setCurrentIndex(slides.length - 1);
          onSlideChange?.(slides.length - 1);
          break;
        case 'b':
        case 'B':
          e.preventDefault();
          setIsBlackout(prev => !prev);
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, goToNext, goToPrev, slides.length, onClose, onSlideChange]);

  if (!isOpen || slides.length === 0) return null;

  const currentSlide = slides[currentIndex] || slides[0];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black select-none overflow-hidden"
      onClick={e => {
        // Tap right half advances, tap left half goes back
        const width = window.innerWidth;
        if (e.clientX > width / 2) {
          goToNext();
        } else {
          goToPrev();
        }
      }}
    >
      {/* Blackout overlay (turns projector black when 'B' is pressed) */}
      {isBlackout ? (
        <div className="w-full h-full bg-black flex items-center justify-center">
          {showControls && (
            <span className="text-neutral-600 text-sm font-sans tracking-widest uppercase">
              Tela Oculta (Pressione B para restaurar)
            </span>
          )}
        </div>
      ) : (
        /* Slide Screen Content - 100% minimalist pure text */
        <div className="w-full h-full flex items-center justify-center">
          <SlideCanvas
            slide={currentSlide}
            settings={settings}
            isPresentationMode={true}
            className="w-full h-full"
          />
        </div>
      )}

      {/* Floating Operator Controls (Fades out for clean presentation) */}
      <div
        className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2 rounded-full bg-neutral-900/80 backdrop-blur-md border border-neutral-800 text-white transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={e => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={goToPrev}
          disabled={currentIndex === 0}
          className="px-3 py-1 text-xs rounded bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 transition-colors"
        >
          Anterior
        </button>

        <span className="text-xs font-mono px-2 text-neutral-300">
          Slide {currentIndex + 1} / {slides.length}
        </span>

        <button
          type="button"
          onClick={goToNext}
          disabled={currentIndex === slides.length - 1}
          className="px-3 py-1 text-xs rounded bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 transition-colors"
        >
          Próximo
        </button>

        <div className="h-4 w-px bg-neutral-700 mx-1" />

        <button
          type="button"
          onClick={() => setIsBlackout(b => !b)}
          className={`px-3 py-1 text-xs rounded transition-colors ${
            isBlackout ? 'bg-amber-600 text-white' : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
          }`}
          title="Atalho: B"
        >
          {isBlackout ? 'Restaurar' : 'Ocultar (B)'}
        </button>

        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1 text-xs rounded bg-red-950/80 hover:bg-red-900 text-red-200 transition-colors ml-1"
          title="Atalho: Esc"
        >
          Sair (Esc)
        </button>
      </div>
    </div>
  );
};
