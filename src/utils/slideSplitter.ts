import { SlideItem, SlideSettings } from '../types';

/**
 * Formats a block of verse lines with commas between phrases while preserving line breaks.
 * (unless a line already ends with punctuation like , . ! ? :)
 */
export function formatLinesWithCommas(lines: string[]): string[] {
  return lines
    .map(line => line.trim())
    .filter(Boolean)
    .map((line, idx, arr) => {
      // If it's the last line of the stanza chunk, keep as is
      if (idx === arr.length - 1) {
        return line;
      }
      // Check if line already ends with punctuation
      if (/[,.!?:;—–-]$/.test(line)) {
        return line;
      }
      return `${line},`;
    });
}

/**
 * Utility to format raw lyrics text by adding commas at phrase changes across stanzas
 */
export function formatLyricsWithCommas(rawLyrics: string): string {
  const stanzas = rawLyrics.split(/\n\s*\n+/);
  return stanzas
    .map(stanza => {
      const lines = stanza.split('\n').map(l => l.trim()).filter(Boolean);
      return formatLinesWithCommas(lines).join('\n');
    })
    .join('\n\n');
}

/**
 * Computes exact font size in Container Query Inline (cqi) units for lyrics.
 * Synchronized identically between SlideCanvas and overflow detection.
 * In a 16:9 slide: 100cqi = slide width, 56.25cqi = slide height.
 * In a 4:3 slide: 100cqi = slide width, 75cqi = slide height.
 */
export function computeLyricsFontSizeCqi(
  lines: string[],
  settings: SlideSettings
): number {
  const {
    fontSizePt = 54,
    lineHeight = 1.16,
    safeMarginPercent = 5,
    aspectRatio = '16:9',
    autoFitMaxSpace = true,
    fontFamily = 'arial',
  } = settings;

  const availWidthCqi = 100 - safeMarginPercent * 2;
  const availHeightCqi =
    (aspectRatio === '4:3' ? 75 : 56.25) * ((100 - safeMarginPercent * 2) / 100);

  const userRequestedCqi = (fontSizePt / 54) * 4.8;
  const isArialBlack = fontFamily === 'arial-black';
  const charWidthFactor = isArialBlack ? 0.74 : 0.65;

  if (!lines || lines.length === 0) return userRequestedCqi;

  const continuousText = lines.join(' ').trim();
  const words = continuousText.split(/\s+/).filter(Boolean);
  if (words.length === 0) return userRequestedCqi;

  // Iteratively find max font size (in cqi) where continuous text wraps cleanly inside safe box
  let maxFittingCqi = 2.0;

  for (let fCqi = 6.5; fCqi >= 1.8; fCqi -= 0.1) {
    const charWidthCqi = fCqi * charWidthFactor;
    const maxCharsPerLine = Math.max(6, Math.floor(availWidthCqi / charWidthCqi));

    let totalVisualLines = 1;
    let currentLineChars = 0;
    let wordOverflows = false;

    for (const w of words) {
      if (w.length * charWidthCqi > availWidthCqi) {
        wordOverflows = true;
        break;
      }
      if (currentLineChars === 0) {
        currentLineChars = w.length;
      } else if (currentLineChars + 1 + w.length <= maxCharsPerLine) {
        currentLineChars += 1 + w.length;
      } else {
        totalVisualLines++;
        currentLineChars = w.length;
      }
    }

    if (wordOverflows) continue;

    const totalHeightCqi = totalVisualLines * (fCqi * Math.max(1.15, lineHeight));
    if (totalHeightCqi <= availHeightCqi * 0.95) {
      maxFittingCqi = fCqi;
      break;
    }
  }

  if (autoFitMaxSpace) {
    return Math.min(userRequestedCqi, maxFittingCqi);
  } else {
    return userRequestedCqi;
  }
}

export interface SlideOverflowResult {
  overflows: boolean;
  overflowPercent: number;
  visualLines: number;
  maxFittingLines: number;
  contentHeightCqi: number;
  availHeightCqi: number;
  reason?: string;
}

/**
 * Accurately measures whether a slide's lyrics overflow the safe bounding box.
 * Takes into account:
 * 1. Natural word wrapping on lines longer than the available safe width
 * 2. Total accumulated height of all visual lines vs available safe height
 * 3. Individual line horizontal overflow
 */
export function measureSlideOverflow(
  lines: string[],
  settings: SlideSettings
): SlideOverflowResult {
  const {
    lineHeight = 1.16,
    safeMarginPercent = 5,
    aspectRatio = '16:9',
    fontFamily = 'arial',
  } = settings;

  const availWidthCqi = 100 - safeMarginPercent * 2;
  const availHeightCqi =
    (aspectRatio === '4:3' ? 75 : 56.25) * ((100 - safeMarginPercent * 2) / 100);

  const fontSizeCqi = computeLyricsFontSizeCqi(lines, settings);
  const singleLineHeightCqi = fontSizeCqi * Math.max(1.20, lineHeight);
  const maxFittingLines = Math.max(1, Math.floor(availHeightCqi / singleLineHeightCqi));

  // In Arial Black uppercase, char width averages ~0.74 * fontSizeCqi
  const isArialBlack = fontFamily === 'arial-black';
  const charWidthCqi = fontSizeCqi * (isArialBlack ? 0.74 : 0.65);
  const maxCharsPerLine = Math.max(6, Math.floor(availWidthCqi / charWidthCqi));

  let totalVisualLines = 0;
  let maxLineWidthCqi = 0;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    const words = trimmed.split(/\s+/);
    let currentLineChars = 0;
    let wrappedForThisLine = 1;

    for (const word of words) {
      const wordLen = word.length;
      if (wordLen * charWidthCqi > availWidthCqi) {
        maxLineWidthCqi = Math.max(maxLineWidthCqi, wordLen * charWidthCqi);
      }
      if (currentLineChars === 0) {
        currentLineChars = wordLen;
      } else if (currentLineChars + 1 + wordLen <= maxCharsPerLine) {
        currentLineChars += 1 + wordLen;
      } else {
        wrappedForThisLine++;
        currentLineChars = wordLen;
      }
    }

    const lineWidth = currentLineChars * charWidthCqi;
    maxLineWidthCqi = Math.max(maxLineWidthCqi, lineWidth);
    totalVisualLines += wrappedForThisLine;
  }

  const totalHeightCqi = totalVisualLines * singleLineHeightCqi;
  const heightRatio = totalHeightCqi / availHeightCqi;
  const widthRatio = maxLineWidthCqi / availWidthCqi;

  const overflowRatio = Math.max(heightRatio, widthRatio);
  const overflowPercent = Math.round(overflowRatio * 100);
  // Flag as overflow whenever content exceeds the safe box (>100%)
  const overflows = overflowRatio > 1.01;

  let reason: string | undefined = undefined;
  if (overflows) {
    if (heightRatio > 1.01 && widthRatio > 1.01) {
      reason = `Ultrapassa altura (${totalVisualLines} linhas ocupam ${Math.round(heightRatio * 100)}%) e largura (${Math.round(widthRatio * 100)}%)`;
    } else if (heightRatio > 1.01) {
      reason = `${totalVisualLines} linhas ocupam ${Math.round(heightRatio * 100)}% da altura segura (${maxFittingLines} linhas cabem)`;
    } else {
      reason = `Texto muito largo ultrapassa as margens laterais (${Math.round(widthRatio * 100)}%)`;
    }
  }

  return {
    overflows,
    overflowPercent,
    visualLines: totalVisualLines,
    maxFittingLines,
    contentHeightCqi: totalHeightCqi,
    availHeightCqi,
    reason,
  };
}

export interface StanzaOverflowStatus {
  stanzaIndex: number;
  lines: string[];
  rawText: string;
  visualLines: number;
  maxLines: number;
  overflows: boolean;
  overflowPercent: number;
  reason?: string;
}

/**
 * Analyzes all stanzas in the raw lyrics to identify exactly which ones overflow
 */
export function analyzeStanzasOverflow(
  rawLyrics: string,
  settings: SlideSettings
): StanzaOverflowStatus[] {
  const rawChunks = rawLyrics.includes('---') || rawLyrics.includes('===')
    ? rawLyrics.split(/\n\s*[-=]{3,}\s*\n/)
    : rawLyrics.split(/\n\s*\n+/);

  return rawChunks
    .map(chunk => chunk.trim())
    .filter(Boolean)
    .map((chunk, idx) => {
      const rawLines = chunk.split('\n').map(l => l.trim()).filter(Boolean);
      const lines = settings.addCommasToPhrases
        ? formatLinesWithCommas(rawLines)
        : rawLines;

      const measurement = measureSlideOverflow(lines, settings);

      return {
        stanzaIndex: idx + 1,
        lines,
        rawText: chunk,
        visualLines: measurement.visualLines,
        maxLines: measurement.maxFittingLines,
        overflows: measurement.overflows,
        overflowPercent: measurement.overflowPercent,
        reason: measurement.reason,
      };
    });
}

/**
 * Splits raw lyrics text into slide items.
 * Stanzas remain as the user organized them.
 * Every slide is tested against measureSlideOverflow to flag any overflow automatically.
 */
export function buildSlides(
  title: string,
  artist: string,
  rawLyrics: string,
  settings: SlideSettings
): SlideItem[] {
  const slides: SlideItem[] = [];

  const rawTitle = title.trim() || 'TÍTULO DA MÚSICA';
  const rawArtist = artist.trim() || 'ARTISTA';

  // Slide 1: Song Title & Discreet Artist
  slides.push({
    id: 'slide-title',
    index: 0,
    type: 'title',
    title: rawTitle,
    artist: rawArtist,
    lines: [rawTitle],
    continuousText: rawTitle,
    rawText: `${rawTitle}\n${rawArtist}`,
    overflows: false,
    overflowPercent: 60,
  });

  if (!rawLyrics.trim()) {
    return slides;
  }

  const {
    addCommasToPhrases = true,
    splitMode = 'paragraph',
    maxLinesPerSlide = 6,
  } = settings;

  // 1. Explicit slide break delimiters (e.g. '---' or '===')
  if (rawLyrics.includes('---') || rawLyrics.includes('===')) {
    const rawChunks = rawLyrics.split(/\n\s*[-=]{3,}\s*\n/);
    let slideIdx = 1;

    for (const chunk of rawChunks) {
      const trimmed = chunk.trim();
      if (!trimmed) continue;
      const rawLines = trimmed.split('\n').map(l => l.trim()).filter(Boolean);
      const lines = addCommasToPhrases
        ? formatLinesWithCommas(rawLines)
        : rawLines;

      const measurement = measureSlideOverflow(lines, settings);

      slides.push({
        id: `slide-${slideIdx}`,
        index: slideIdx,
        type: 'lyrics',
        lines,
        continuousText: lines.join(' '),
        rawText: trimmed,
        overflows: measurement.overflows,
        overflowPercent: measurement.overflowPercent,
        overflowReason: measurement.reason,
      });
      slideIdx++;
    }
    return slides;
  }

  // 2. Standard Stanza Splitting (Paragraphs)
  if (splitMode === 'paragraph') {
    const rawStanzas = rawLyrics.split(/\n\s*\n+/);
    let slideIdx = 1;

    for (const stanza of rawStanzas) {
      const trimmed = stanza.trim();
      if (!trimmed) continue;

      const rawLines = trimmed.split('\n').map(l => l.trim()).filter(Boolean);
      if (rawLines.length === 0) continue;

      const lines = addCommasToPhrases
        ? formatLinesWithCommas(rawLines)
        : rawLines;

      const measurement = measureSlideOverflow(lines, settings);

      slides.push({
        id: `slide-${slideIdx}`,
        index: slideIdx,
        type: 'lyrics',
        lines,
        continuousText: lines.join(' '),
        rawText: trimmed,
        overflows: measurement.overflows,
        overflowPercent: measurement.overflowPercent,
        overflowReason: measurement.reason,
      });
      slideIdx++;
    }
  } else {
    // Fixed line count splitting (lines_4, lines_6, lines_8)
    const allLines = rawLyrics
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    const chunkSize = maxLinesPerSlide || 6;
    let slideIdx = 1;

    for (let i = 0; i < allLines.length; i += chunkSize) {
      const chunkRaw = allLines.slice(i, i + chunkSize);
      const lines = addCommasToPhrases
        ? formatLinesWithCommas(chunkRaw)
        : chunkRaw;

      const measurement = measureSlideOverflow(lines, settings);

      slides.push({
        id: `slide-${slideIdx}`,
        index: slideIdx,
        type: 'lyrics',
        lines,
        continuousText: lines.join(' '),
        rawText: lines.join(' '),
        overflows: measurement.overflows,
        overflowPercent: measurement.overflowPercent,
        overflowReason: measurement.reason,
      });
      slideIdx++;
    }
  }

  return slides;
}
