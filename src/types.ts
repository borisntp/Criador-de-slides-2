export type SplitMode = 'paragraph' | 'lines_4' | 'lines_6' | 'lines_8' | 'custom';
export type AspectRatio = '16:9' | '4:3';
export type ProjectorTheme = 'black' | 'dark' | 'yellow' | 'white';
export type ProjectorFont = 'arial-black' | 'inter' | 'arial';

export interface SlideSettings {
  fontSizePt: number; // Google Slides font size equivalent (default ~54-60)
  lineHeight: number; // compact ~1.22 for max slide fill
  textTransform: 'uppercase' | 'none'; // default: 'uppercase'
  textAlign: 'center' | 'left';
  aspectRatio: AspectRatio;
  theme: ProjectorTheme;
  fontFamily: ProjectorFont; // default: 'arial'
  safeMarginPercent: number; // default ~6% safe margin
  splitMode: SplitMode;
  maxLinesPerSlide: number;
  addCommasToPhrases: boolean; // Add comma on phrase change (texto corrido)
  autoFitMaxSpace: boolean; // Fill maximum slide space without overflowing
  showSafeBorderGuide?: boolean; // Visual bounding box outline like Google Slides
}

export interface SlideItem {
  id: string;
  index: number;
  type: 'title' | 'lyrics';
  title?: string;
  artist?: string;
  lines: string[];
  continuousText?: string;
  rawText: string;
  overflows?: boolean;
  overflowPercent?: number;
  overflowReason?: string;
}

export interface SongMetadata {
  title: string;
  artist: string;
  url?: string;
  source?: string;
}

export interface SearchResultItem {
  id: number;
  trackName: string;
  artistName: string;
  albumName?: string;
  duration?: number;
  plainLyrics?: string;
  syncedLyrics?: string;
}
