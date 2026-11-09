import React, { useMemo } from 'react';
import { SlideItem, SlideSettings } from '../types';
import { computeLyricsFontSizeCqi } from '../utils/slideSplitter';

interface SlideCanvasProps {
  slide: SlideItem;
  settings: SlideSettings;
  isPresentationMode?: boolean;
  className?: string;
  showBoundingGuide?: boolean;
}

export const SlideCanvas: React.FC<SlideCanvasProps> = ({
  slide,
  settings,
  isPresentationMode = false,
  className = '',
  showBoundingGuide = false,
}) => {
  const {
    fontSizePt = 54,
    lineHeight = 1.16,
    textTransform = 'uppercase',
    textAlign = 'center',
    aspectRatio = '16:9',
    theme = 'black',
    fontFamily = 'arial',
    safeMarginPercent = 5,
    autoFitMaxSpace = true,
  } = settings;

  // Theme styling definitions
  const themeStyles = {
    black: {
      bg: '#000000',
      text: '#ffffff',
      artist: 'rgba(255, 255, 255, 0.65)',
      guideBorder: '#3b82f6', // Google Slides blue bounding box
    },
    dark: {
      bg: '#0f172a',
      text: '#f8fafc',
      artist: 'rgba(248, 250, 252, 0.60)',
      guideBorder: '#3b82f6',
    },
    yellow: {
      bg: '#000000',
      text: '#ffeb3b', // High-visibility yellow
      artist: 'rgba(255, 235, 59, 0.65)',
      guideBorder: '#ffeb3b',
    },
    white: {
      bg: '#ffffff',
      text: '#000000',
      artist: 'rgba(0, 0, 0, 0.60)',
      guideBorder: '#3b82f6',
    },
  }[theme] || {
    bg: '#000000',
    text: '#ffffff',
    artist: 'rgba(255, 255, 255, 0.65)',
    guideBorder: '#3b82f6',
  };

  const fontFamilies = {
    'arial-black': "'Arial Black', 'Impact', 'Inter', -apple-system, sans-serif",
    'inter': "'Inter', -apple-system, sans-serif",
    'arial': "Arial, Helvetica, sans-serif",
  };

  const selectedFontFamily = fontFamilies[fontFamily] || fontFamilies['arial'];
  const fontWeight = fontFamily === 'arial-black' ? 900 : 700;

  // Split lines respecting natural line breaks from editor and splitter
  const displayLines = useMemo(() => {
    if (slide.type === 'title') {
      return [slide.title || 'TÍTULO DA MÚSICA'];
    }
    const raw = slide.continuousText || slide.lines.join('\n');
    return raw.split('\n').map(l => l.trim()).filter(Boolean);
  }, [slide]);

  // Synchronous Container Query (cqi) calculation for INSTANTANEOUS preview update
  // 1cqi = 1% of slide width. In 16:9, height is 56.25cqi.
  const computedFontSizeCqi = useMemo(() => {
    const availWidthCqi = 100 - safeMarginPercent * 2;
    if (slide.type === 'title') {
      const titleLen = (slide.title || 'TÍTULO DA MÚSICA').length;
      const maxFitW = (availWidthCqi / Math.max(8, titleLen * 0.60)) * 0.95;
      const baseTitleCqi = (fontSizePt / 54) * 6.0;
      return Math.min(baseTitleCqi, maxFitW);
    }

    return computeLyricsFontSizeCqi(displayLines, settings);
  }, [
    slide,
    displayLines,
    settings,
    fontSizePt,
    safeMarginPercent,
  ]);

  const aspectClass = aspectRatio === '4:3' ? 'aspect-[4/3]' : 'aspect-[16/9]';
  const isOverflowing = Boolean(slide.overflows);
  const guideColor = isOverflowing ? '#ef4444' : themeStyles.guideBorder;

  return (
    <div
      className={`relative w-full ${
        isPresentationMode ? 'h-full max-h-screen' : aspectClass
      } select-none overflow-hidden flex flex-col justify-center items-center ${className}`}
      style={{
        backgroundColor: themeStyles.bg,
        color: themeStyles.text,
        containerType: 'inline-size',
        fontFamily: selectedFontFamily,
      }}
    >
      {/* Safe Area Text Box (Caixa de Texto estilo Google Slides) */}
      <div
        className="relative flex flex-col justify-center items-center transition-all overflow-hidden"
        style={{
          width: `${100 - safeMarginPercent * 2}%`,
          height: `${100 - safeMarginPercent * 2}%`,
          textAlign: textAlign,
        }}
      >
        {/* Google Slides Bounding Box Guide with Handles (Turns red if overflowing) */}
        {showBoundingGuide && !isPresentationMode && (
          <div
            className={`absolute inset-0 pointer-events-none border-2 rounded-sm z-20 transition-colors ${
              isOverflowing ? 'border-red-500 shadow-[0_0_12px_rgba(239,68,68,0.4)]' : 'border-blue-500'
            }`}
            style={{
              borderColor: guideColor,
            }}
          >
            {/* Top Rotation handle pin */}
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 flex flex-col items-center">
              <span
                className="w-4 h-4 rounded-full border-2 bg-black flex items-center justify-center text-[10px]"
                style={{ borderColor: guideColor, color: guideColor }}
              >
                ↻
              </span>
              <span className="w-0.5 h-2" style={{ backgroundColor: guideColor }} />
            </div>

            {/* Corner square control points */}
            <span className="absolute -top-1.5 -left-1.5 w-3 h-3 border border-white rounded-none" style={{ backgroundColor: guideColor }} />
            <span className="absolute -top-1.5 -right-1.5 w-3 h-3 border border-white rounded-none" style={{ backgroundColor: guideColor }} />
            <span className="absolute -bottom-1.5 -left-1.5 w-3 h-3 border border-white rounded-none" style={{ backgroundColor: guideColor }} />
            <span className="absolute -bottom-1.5 -right-1.5 w-3 h-3 border border-white rounded-none" style={{ backgroundColor: guideColor }} />

            {/* Midpoint control points */}
            <span className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-3 border border-white rounded-none" style={{ backgroundColor: guideColor }} />
            <span className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-3 border border-white rounded-none" style={{ backgroundColor: guideColor }} />
            <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 border border-white rounded-none" style={{ backgroundColor: guideColor }} />
            <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 border border-white rounded-none" style={{ backgroundColor: guideColor }} />
          </div>
        )}

        {slide.type === 'title' ? (
          /* Slide 1: Song Title + Discreet Artist */
          <div
            className="w-full flex flex-col justify-center items-center text-center uppercase transition-all duration-75"
            style={{
              fontSize: `${computedFontSizeCqi}cqi`,
              lineHeight: 1.15,
              textTransform: textTransform,
            }}
          >
            <h1
              className="tracking-tight leading-tight max-w-full break-words"
              style={{
                fontWeight: fontWeight,
                color: themeStyles.text,
              }}
            >
              {slide.title || 'TÍTULO DA MÚSICA'}
            </h1>
            {slide.artist && (
              <p
                className="tracking-wider max-w-full break-words"
                style={{
                  fontSize: `${computedFontSizeCqi * 0.38}cqi`,
                  color: themeStyles.artist,
                  fontWeight: 600,
                  marginTop: '0.6em',
                  letterSpacing: '0.05em',
                }}
              >
                {slide.artist}
              </p>
            )}
          </div>
        ) : (
          /* Slide 2..N: Lyrics rendered as single fluid continuous text block */
          <div
            className="w-full break-words uppercase transition-all duration-75"
            style={{
              fontSize: `${computedFontSizeCqi}cqi`,
              lineHeight: lineHeight,
              fontWeight: fontWeight,
              letterSpacing: '-0.015em',
              color: themeStyles.text,
              textTransform: textTransform,
              textAlign: textAlign,
            }}
          >
            {slide.continuousText || slide.lines.join(' ')}
          </div>
        )}
      </div>
    </div>
  );
};
