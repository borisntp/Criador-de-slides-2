import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Play,
  ExternalLink,
  Search,
  Copy,
  Download,
  Monitor,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  Sliders,
  Type,
  FileText,
  RotateCcw,
  Check,
  CheckSquare,
  Square,
  Sparkles,
  AlertTriangle,
  Scissors,
} from 'lucide-react';
import { SlideSettings, SlideItem, SearchResultItem } from './types';
import {
  buildSlides,
  formatLyricsWithCommas,
} from './utils/slideSplitter';
import {
  parseLetrasInput,
  fetchLyricsFromService,
  searchTracks,
  SAMPLE_SONGS,
} from './services/lyricsService';
import { SlideCanvas } from './components/SlideCanvas';
import { PresentationModal } from './components/PresentationModal';
import { ProjectorDisplay } from './components/ProjectorDisplay';
import { ProjectorBroadcaster } from './utils/projectorSync';
import { formatSlidesForClipboard, exportStandaloneHtml } from './utils/exporter';
import { initAuth, googleSignIn, getAccessToken, logoutGoogle } from './services/googleAuth';
import { createGoogleSlidesPresentation } from './services/googleSlidesGenerator';

export default function App() {
  // Check if current window was opened as a dedicated projector display
  const isDedicatedProjector = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.location.search.includes('projector=true') ||
      window.location.hash.includes('projector')
    );
  }, []);

  if (isDedicatedProjector) {
    return <ProjectorDisplay />;
  }

  // --- Main Application State (Defaulting to Diante do Trono from screenshot) ---
  const [urlInput, setUrlInput] = useState(SAMPLE_SONGS[0].url);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [copiedMessage, setCopiedMessage] = useState<string | null>(null);

  // Active Song Data (Slide 1 title & artist + exact lyrics)
  const [songTitle, setSongTitle] = useState(SAMPLE_SONGS[0].title);
  const [songArtist, setSongArtist] = useState(SAMPLE_SONGS[0].artist);
  const [rawLyrics, setRawLyrics] = useState(SAMPLE_SONGS[0].lyrics);

  // Projector & Slide Settings (Default: UPPERCASE, Arial Black, Auto-fit Max Space, Comma on phrase break)
  const [settings, setSettings] = useState<SlideSettings>({
    fontSizePt: 54, // ~53-60pt no slide do google
    lineHeight: 1.16, // Entrelinha compacta para preencher o máximo do texto
    textTransform: 'uppercase', // Toda maiúscula por padrão
    textAlign: 'center',
    aspectRatio: '16:9',
    theme: 'black',
    fontFamily: 'arial', // Arial Bold do Google Slides
    safeMarginPercent: 5, // Margem de segurança de ~5% para preencher o máximo da caixa
    splitMode: 'paragraph',
    maxLinesPerSlide: 6,
    addCommasToPhrases: true, // Acrescentar uma vírgula na troca de frase
    autoFitMaxSpace: true, // Preenche o máximo possível da caixa de texto
    showSafeBorderGuide: true, // Mostra a caixa/borda azul de segurança na prévia
  });

  // Active Slide Selection & Presentation Mode
  const [currentSlideIndex, setCurrentSlideIndex] = useState(1); // Default to first verse slide to showcase lyrics
  const [isPresentationOpen, setIsPresentationOpen] = useState(false);

  // Mobile view tab toggle: 'preview' or 'editor'
  const [mobileTab, setMobileTab] = useState<'preview' | 'editor'>('preview');

  // Google Slides Direct Generation state
  const [isGeneratingSlides, setIsGeneratingSlides] = useState(false);
  const [createdSlidesUrl, setCreatedSlidesUrl] = useState<string | null>(null);
  const [googleUserEmail, setGoogleUserEmail] = useState<string | null>(null);

  // Initialize Google Auth state listener
  useEffect(() => {
    const unsubscribe = initAuth((user) => {
      setGoogleUserEmail(user.email);
    }, () => {
      setGoogleUserEmail(null);
    });
    return () => unsubscribe();
  }, []);

  // Broadcaster for 2nd screen / projector window
  const broadcasterRef = useRef<ProjectorBroadcaster | null>(null);

  useEffect(() => {
    broadcasterRef.current = new ProjectorBroadcaster();
    return () => {
      broadcasterRef.current?.close();
    };
  }, []);

  // Compute slides dynamically whenever lyrics, title, artist, or split settings change
  const slides: SlideItem[] = useMemo(() => {
    return buildSlides(songTitle, songArtist, rawLyrics, settings);
  }, [songTitle, songArtist, rawLyrics, settings]);

  // Directly identify all overflowing slides across the presentation
  const overflowingSlides = useMemo(() => {
    return slides.filter(s => s.type === 'lyrics' && s.overflows);
  }, [slides]);

  // Manually split an overflowing slide in half with '---'
  const handleSplitSlide = (slideIndex: number) => {
    if (slideIndex < 1) return; // slide 0 is title
    const chunkIndex = slideIndex - 1;

    const hasExplicit = rawLyrics.includes('---') || rawLyrics.includes('===');
    const rawChunks = hasExplicit
      ? rawLyrics.split(/\n\s*[-=]{3,}\s*\n/)
      : rawLyrics.split(/\n\s*\n+/);

    if (chunkIndex >= rawChunks.length) return;

    const chunkToSplit = rawChunks[chunkIndex].trim();
    const lines = chunkToSplit.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length <= 1) return;

    const mid = Math.ceil(lines.length / 2);
    const part1 = lines.slice(0, mid).join('\n');
    const part2 = lines.slice(mid).join('\n');
    const replaced = `${part1}\n---\n${part2}`;

    rawChunks[chunkIndex] = replaced;

    const delimiter = hasExplicit ? '\n---\n' : '\n\n';
    setRawLyrics(rawChunks.join(delimiter));
    setCopiedMessage(`Slide ${slideIndex + 1} dividido ao meio com '---'!`);
    setTimeout(() => setCopiedMessage(null), 3500);
  };

  // Keep current slide index in valid bounds
  useEffect(() => {
    if (currentSlideIndex >= slides.length) {
      setCurrentSlideIndex(Math.max(0, slides.length - 1));
    }
  }, [slides.length, currentSlideIndex]);

  // Broadcast state changes to any open projector window
  useEffect(() => {
    broadcasterRef.current?.send({
      type: 'DATA_UPDATE',
      slides,
      settings,
      currentIndex: currentSlideIndex,
    });
  }, [slides, settings, currentSlideIndex]);

  // Handle loading song from URL or search
  const handleLoadSong = async (customQuery?: string) => {
    const query = (customQuery || urlInput).trim();
    if (!query) return;

    setIsLoading(true);
    setErrorMessage(null);
    setSearchResults([]);

    try {
      const data = await fetchLyricsFromService(query);
      if (data.title) setSongTitle(data.title);
      if (data.artist) setSongArtist(data.artist);
      if (data.lyrics) {
        setRawLyrics(data.lyrics);
      }
      setCurrentSlideIndex(1); // Show first lyrics slide
    } catch (err: any) {
      setErrorMessage(
        err.message ||
          'Não foi possível extrair a letra automaticamente deste link. Você pode colar o texto da letra diretamente no editor ao lado.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Quick live search when typing in URL / search box
  useEffect(() => {
    const trimmed = urlInput.trim();
    if (!trimmed || trimmed.startsWith('http') || trimmed.length < 3) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const results = await searchTracks(trimmed);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [urlInput]);

  // Select a search result
  const handleSelectSearchResult = (item: SearchResultItem) => {
    setSongTitle(item.trackName || 'Título');
    setSongArtist(item.artistName || 'Artista');
    if (item.plainLyrics) {
      setRawLyrics(item.plainLyrics);
    }
    setUrlInput(
      `https://www.letras.mus.br/${encodeURIComponent(item.artistName)}/${encodeURIComponent(item.trackName)}/`
    );
    setSearchResults([]);
    setCurrentSlideIndex(1);
  };

  // Select a preset sample song from Letras.mus.br
  const handleSelectSample = (sample: (typeof SAMPLE_SONGS)[0]) => {
    setUrlInput(sample.url);
    setSongTitle(sample.title);
    setSongArtist(sample.artist);
    setRawLyrics(sample.lyrics);
    setCurrentSlideIndex(1);
    setErrorMessage(null);
  };

  // Format raw lyrics with commas into the editor textarea
  const handleApplyCommasToEditor = () => {
    const formatted = formatLyricsWithCommas(rawLyrics);
    setRawLyrics(formatted);
    setCopiedMessage('Vírgulas aplicadas na troca de frases no editor!');
    setTimeout(() => setCopiedMessage(null), 3000);
  };

  // Open secondary projector window for external display
  const handleOpenProjectorWindow = () => {
    const projectorUrl = `${window.location.origin}${window.location.pathname}?projector=true`;
    window.open(
      projectorUrl,
      'LetrasProjetorDisplay',
      'width=1280,height=720,menubar=no,toolbar=no,location=no,status=no'
    );
  };

  // Copy slides formatted for Google Slides
  const handleCopyGoogleSlides = async () => {
    const formatted = formatSlidesForClipboard(slides);
    try {
      await navigator.clipboard.writeText(formatted);
      setCopiedMessage('Slides copiados em MAIÚSCULAS para o Google Slides!');
      setTimeout(() => setCopiedMessage(null), 3500);
    } catch {
      setCopiedMessage('Falha ao copiar automaticamente.');
    }
  };

  // Directly create presentation in user's active Google Slides account
  const handleGenerateGoogleSlides = async () => {
    setIsGeneratingSlides(true);
    setErrorMessage(null);
    setCreatedSlidesUrl(null);

    try {
      let token = await getAccessToken();
      if (!token) {
        const authResult = await googleSignIn();
        if (!authResult) {
          throw new Error('Autenticação com a Conta Google não foi concluída.');
        }
        token = authResult.accessToken;
        setGoogleUserEmail(authResult.user.email);
      }

      const result = await createGoogleSlidesPresentation({
        accessToken: token,
        songTitle,
        songArtist,
        slides,
        settings,
      });

      setCreatedSlidesUrl(result.presentationUrl);
      setCopiedMessage('Apresentação criada no seu Google Slides!');

      // Automatically open the new presentation in a new tab
      window.open(result.presentationUrl, '_blank');
    } catch (err: any) {
      console.error('Erro ao gerar no Google Slides:', err);
      setErrorMessage(
        err.message || 'Não foi possível gerar a apresentação no Google Slides. Tente novamente.'
      );
    } finally {
      setIsGeneratingSlides(false);
    }
  };

  // Download standalone offline HTML presentation
  const handleDownloadStandaloneHtml = () => {
    const html = exportStandaloneHtml(songTitle, songArtist, slides, settings);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${songTitle.toLowerCase().replace(/\s+/g, '-')}-slides.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const activeSlide = slides[currentSlideIndex] || slides[0];

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans antialiased selection:bg-neutral-800">
      {/* Top Header & Search Bar */}
      <header className="border-b border-neutral-800 bg-neutral-900/90 backdrop-blur sticky top-0 z-30 px-3 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Branding Title */}
            <div className="flex items-center gap-2">
              <span className="font-bold text-base sm:text-lg tracking-tight text-white flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
                Letras Projetor
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-blue-950/80 text-blue-300 border border-blue-800/60 hidden sm:inline font-mono">
                MAIÚSCULA • ARIAL BOLD • PREENCHIMENTO MÁXIMO
              </span>
            </div>

            {/* Top Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleGenerateGoogleSlides}
                disabled={isGeneratingSlides}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-md bg-blue-600 hover:bg-blue-500 text-white border border-blue-400 disabled:opacity-50 transition shadow-sm"
                title="Criar a apresentação diretamente no Google Slides da sua conta ativa no navegador"
              >
                {isGeneratingSlides ? (
                  <>
                    <span className="inline-block animate-spin">⏳</span>
                    <span>Gerando no Google Slides...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                    <span>Gerar no Google Slides</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleDownloadStandaloneHtml}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition"
                title="Baixar apresentação autônoma em arquivo HTML para abrir em qualquer projetor"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Baixar</span> HTML
              </button>

              <button
                type="button"
                onClick={handleOpenProjectorWindow}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition"
                title="Abre uma 2ª janela dedicada exclusivamente ao projetor"
              >
                <Monitor className="w-3.5 h-3.5" />
                <span className="hidden md:inline">2ª Tela</span> Projetor
              </button>

              <button
                type="button"
                onClick={() => setIsPresentationOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-md bg-white hover:bg-neutral-200 text-black transition shadow-sm"
              >
                <Play className="w-3.5 h-3.5 fill-black" />
                Apresentar (F11)
              </button>
            </div>
          </div>

          {/* Letras.mus.br URL or Song Search Input */}
          <div className="relative w-full">
            <form
              onSubmit={e => {
                e.preventDefault();
                handleLoadSong();
              }}
              className="flex items-center gap-2"
            >
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
                  <Search className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={urlInput}
                  onChange={e => setUrlInput(e.target.value)}
                  placeholder="Cole o link do Letras.mus.br (ex: https://www.letras.mus.br/diante-do-trono/45493/) ou busque música..."
                  className="w-full pl-9 pr-24 py-2 text-xs sm:text-sm bg-neutral-950 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-400 focus:border-neutral-400 font-mono"
                />
                {urlInput.includes('letras.mus.br') && (
                  <a
                    href={urlInput.startsWith('http') ? urlInput : `https://${urlInput}`}
                    target="_blank"
                    rel="noreferrer"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white text-xs flex items-center gap-1 px-1.5 py-0.5 rounded bg-neutral-800/80"
                    title="Abrir no Letras.mus.br"
                  >
                    <span>Letras</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading || !urlInput.trim()}
                className="px-4 py-2 text-xs sm:text-sm font-medium rounded-lg bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-white border border-neutral-700 transition flex items-center gap-1.5 shrink-0"
              >
                {isLoading ? (
                  <span className="inline-block animate-spin">⏳</span>
                ) : (
                  <span>Carregar Letra</span>
                )}
              </button>
            </form>

            {/* Quick search suggestions dropdown */}
            {searchResults.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-neutral-900 border border-neutral-700 rounded-lg shadow-2xl overflow-hidden max-h-64 overflow-y-auto">
                <div className="px-3 py-1.5 text-[11px] font-medium text-neutral-400 border-b border-neutral-800 uppercase tracking-wider">
                  Músicas encontradas no catálogo
                </div>
                {searchResults.map(result => (
                  <button
                    key={result.id}
                    type="button"
                    onClick={() => handleSelectSearchResult(result)}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-neutral-800 flex items-center justify-between border-b border-neutral-850 last:border-0 transition"
                  >
                    <div>
                      <span className="font-semibold text-white">{result.trackName}</span>
                      <span className="text-neutral-400 ml-2">— {result.artistName}</span>
                    </div>
                    {result.albumName && (
                      <span className="text-[11px] text-neutral-500 truncate max-w-[160px]">
                        {result.albumName}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Preset Sample Badges */}
          <div className="flex items-center gap-1.5 flex-wrap text-xs text-neutral-400">
            <span className="text-neutral-500 text-[11px]">Exemplos rápidos do Letras:</span>
            {SAMPLE_SONGS.map(sample => (
              <button
                key={sample.title}
                type="button"
                onClick={() => handleSelectSample(sample)}
                className={`px-2 py-0.5 rounded text-[11px] transition border ${
                  songTitle === sample.title && songArtist === sample.artist
                    ? 'bg-neutral-700 text-white border-neutral-400 font-semibold'
                    : 'bg-neutral-900 text-neutral-400 hover:text-neutral-200 border-neutral-800 hover:border-neutral-700'
                }`}
              >
                {sample.title} ({sample.artist})
              </button>
            ))}
          </div>

          {/* Created Google Slides success banner */}
          {createdSlidesUrl && (
            <div className="px-3.5 py-2.5 rounded-lg bg-blue-950/90 border border-blue-500 text-blue-100 text-xs flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-yellow-300 shrink-0" />
                <span>
                  Apresentação <strong>"{songTitle}"</strong> gerada com sucesso no Google Slides da sua conta!
                </span>
              </div>
              <a
                href={createdSlidesUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1 rounded bg-blue-500 hover:bg-blue-400 text-white font-bold text-xs flex items-center gap-1 shadow transition shrink-0 ml-2"
              >
                <span>Abrir no Google Slides</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}

          {/* Feedback banner */}
          {copiedMessage && (
            <div className="px-3 py-1.5 rounded bg-emerald-950/80 border border-emerald-800 text-emerald-200 text-xs flex items-center gap-2">
              <Check className="w-3.5 h-3.5" />
              <span>{copiedMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="px-3 py-2 rounded bg-amber-950/70 border border-amber-800 text-amber-200 text-xs flex items-center justify-between">
              <span>{errorMessage}</span>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="text-amber-400 hover:text-amber-100 underline text-[11px] ml-2"
              >
                Fechar
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Mobile Tab Switcher */}
      <div className="md:hidden flex border-b border-neutral-800 bg-neutral-900">
        <button
          type="button"
          onClick={() => setMobileTab('preview')}
          className={`flex-1 py-2.5 text-xs font-semibold text-center border-b-2 transition ${
            mobileTab === 'preview'
              ? 'border-white text-white bg-neutral-850'
              : 'border-transparent text-neutral-400 hover:text-neutral-200'
          }`}
        >
          Prévia dos Slides ({slides.length})
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('editor')}
          className={`flex-1 py-2.5 text-xs font-semibold text-center border-b-2 transition ${
            mobileTab === 'editor'
              ? 'border-white text-white bg-neutral-850'
              : 'border-transparent text-neutral-400 hover:text-neutral-200'
          }`}
        >
          Editar Letra & Ajustes
        </button>
      </div>

      {/* Main Workspace (Side-by-Side on Desktop, Responsive on Mobile) */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* LEFT COLUMN: Editor de Letra & Ajustes */}
        <div
          className={`md:col-span-5 lg:col-span-5 flex flex-col gap-5 ${
            mobileTab === 'preview' ? 'hidden md:flex' : 'flex'
          }`}
        >
          {/* Card: Slide 1 Setup (Title & Artist) */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-neutral-400" />
                Slide 1 (Capa / Título)
              </span>
              <span className="text-[11px] text-neutral-400">
                Cantor discreto e em tamanho menor
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                  Título da Música
                </label>
                <input
                  type="text"
                  value={songTitle}
                  onChange={e => setSongTitle(e.target.value)}
                  placeholder="Ex: Te Agradeço"
                  className="w-full px-3 py-1.5 text-xs sm:text-sm bg-neutral-950 border border-neutral-700 rounded-md text-white focus:outline-none focus:border-neutral-400 uppercase font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                  Autor / Cantor (Discreto)
                </label>
                <input
                  type="text"
                  value={songArtist}
                  onChange={e => setSongArtist(e.target.value)}
                  placeholder="Ex: Diante do Trono"
                  className="w-full px-3 py-1.5 text-xs sm:text-sm bg-neutral-950 border border-neutral-700 rounded-md text-white focus:outline-none focus:border-neutral-400 uppercase"
                />
              </div>
            </div>
          </div>

          {/* Card: Lyrics Editor (Ajuste na Letra) */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex flex-col gap-2 flex-1">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                <Type className="w-3.5 h-3.5 text-neutral-400" />
                Letra Completa (Edição em Tempo Real)
              </span>
              <button
                type="button"
                onClick={handleApplyCommasToEditor}
                className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium bg-blue-950/60 px-2 py-0.5 rounded border border-blue-900"
                title="Inserir vírgula no final de cada frase nas estrofes do editor"
              >
                <Sparkles className="w-3 h-3" />
                Inserir Vírgulas nas Frases
              </button>
            </div>

            <p className="text-[11px] text-neutral-400 leading-relaxed">
              Texto corrido: não exige quebra de linha rígida. O sistema adiciona automaticamente uma vírgula na troca de frase. Para forçar um novo slide, digite <code className="bg-neutral-800 px-1 py-0.5 rounded text-neutral-200 font-mono">---</code> em linha isolada.
            </p>

            {/* Destaque dos slides que estouraram o espaço da tela */}
            {overflowingSlides.length > 0 ? (
              <div className="p-3.5 rounded-lg bg-red-950/90 border-2 border-red-500 text-red-100 text-xs flex flex-col gap-2.5 shadow-md">
                <div className="flex items-center justify-between font-bold text-red-200">
                  <span className="flex items-center gap-1.5 text-xs sm:text-sm text-red-300">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 animate-pulse" />
                    ⚠️ {overflowingSlides.length} slide(s) estouraram o espaço com a fonte em {settings.fontSizePt}pt:
                  </span>
                  <span className="text-[10px] bg-red-900/90 text-red-200 px-2 py-0.5 rounded font-mono">
                    Não cabe no slide
                  </span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {overflowingSlides.map(s => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between bg-red-900/40 p-2.5 rounded border border-red-700/70"
                    >
                      <div className="truncate pr-2">
                        <span className="font-bold text-white">Slide {s.index + 1}:</span>{' '}
                        <span className="text-red-200 italic">"{s.lines[0]}..."</span>{' '}
                        <span className="text-[10px] text-red-300 font-mono block sm:inline sm:ml-2">
                          (Ocupa {s.overflowPercent}% do espaço)
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setCurrentSlideIndex(s.index)}
                          className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-white text-[11px] font-medium transition"
                          title="Ver este slide na prévia"
                        >
                          Ver
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSplitSlide(s.index)}
                          className="px-2.5 py-1 rounded bg-red-500 hover:bg-red-400 text-black font-bold text-[11px] shrink-0 flex items-center gap-1 shadow transition"
                          title="Dividir este slide ao meio inserindo '---'"
                        >
                          <Scissors className="w-3 h-3" />
                          Dividir c/ '---'
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-red-300/90 mt-0.5">
                  💡 <strong>Como corrigir:</strong> reduza o tamanho da letra no slider abaixo ou clique em <strong>Dividir c/ '---'</strong> para separar o slide em dois.
                </p>
              </div>
            ) : (
              <div className="px-3 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-600/70 text-emerald-200 text-xs flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-medium">
                  <Check className="w-4 h-4 text-emerald-400" />
                  Todas as estrofes cabem perfeitamente no slide com a fonte em {settings.fontSizePt}pt!
                </span>
                <span className="text-[10px] text-emerald-400 font-mono font-bold">100% visível</span>
              </div>
            )}

            <textarea
              value={rawLyrics}
              onChange={e => setRawLyrics(e.target.value)}
              placeholder="Cole a letra da música aqui..."
              rows={14}
              className="w-full flex-1 p-3 text-xs sm:text-sm bg-neutral-950 border border-neutral-700 rounded-md text-white focus:outline-none focus:border-neutral-400 font-mono leading-relaxed resize-y uppercase font-semibold"
              spellCheck={false}
            />
          </div>

          {/* Card: Ajustes do Projetor */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-neutral-400" />
                Configurações da Apresentação
              </span>
              <button
                type="button"
                onClick={() =>
                  setSettings(prev => ({
                    ...prev,
                    fontSizePt: 54,
                    safeMarginPercent: 6,
                    lineHeight: 1.22,
                    textTransform: 'uppercase',
                    fontFamily: 'arial',
                    addCommasToPhrases: true,
                    autoFitMaxSpace: true,
                    showSafeBorderGuide: true,
                    splitMode: 'paragraph',
                    maxLinesPerSlide: 6,
                  }))
                }
                className="text-[11px] text-neutral-400 hover:text-white flex items-center gap-1"
                title="Restaurar padrão exato do exemplo enviado"
              >
                <RotateCcw className="w-3 h-3" />
                Padrão Exemplo
              </button>
            </div>

            {/* Quick Feature Toggles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {/* Uppercase Toggle */}
              <button
                type="button"
                onClick={() =>
                  setSettings(prev => ({
                    ...prev,
                    textTransform: prev.textTransform === 'uppercase' ? 'none' : 'uppercase',
                  }))
                }
                className={`p-2 rounded-lg border flex items-center justify-between transition ${
                  settings.textTransform === 'uppercase'
                    ? 'bg-neutral-800 text-white border-neutral-600 font-medium'
                    : 'bg-neutral-950 text-neutral-400 border-neutral-800'
                }`}
              >
                <span>Toda Maiúscula</span>
                {settings.textTransform === 'uppercase' ? (
                  <CheckSquare className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Square className="w-4 h-4 text-neutral-600" />
                )}
              </button>

              {/* Auto-fill Max Space Toggle */}
              <button
                type="button"
                onClick={() =>
                  setSettings(prev => ({
                    ...prev,
                    autoFitMaxSpace: !prev.autoFitMaxSpace,
                  }))
                }
                className={`p-2 rounded-lg border flex items-center justify-between transition ${
                  settings.autoFitMaxSpace
                    ? 'bg-blue-950/80 text-blue-200 border-blue-700 font-semibold'
                    : 'bg-neutral-950 text-neutral-400 border-neutral-800'
                }`}
              >
                <span>Preencher Caixa (Auto)</span>
                {settings.autoFitMaxSpace ? (
                  <CheckSquare className="w-4 h-4 text-blue-400" />
                ) : (
                  <Square className="w-4 h-4 text-neutral-600" />
                )}
              </button>

              {/* Phrase Commas Toggle */}
              <button
                type="button"
                onClick={() =>
                  setSettings(prev => ({
                    ...prev,
                    addCommasToPhrases: !prev.addCommasToPhrases,
                  }))
                }
                className={`p-2 rounded-lg border flex items-center justify-between transition ${
                  settings.addCommasToPhrases
                    ? 'bg-neutral-800 text-white border-neutral-600 font-medium'
                    : 'bg-neutral-950 text-neutral-400 border-neutral-800'
                }`}
              >
                <span>Vírgula na Troca de Frase</span>
                {settings.addCommasToPhrases ? (
                  <CheckSquare className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Square className="w-4 h-4 text-neutral-600" />
                )}
              </button>

              {/* Safe Border Guide Toggle */}
              <button
                type="button"
                onClick={() =>
                  setSettings(prev => ({
                    ...prev,
                    showSafeBorderGuide: !prev.showSafeBorderGuide,
                  }))
                }
                className={`p-2 rounded-lg border flex items-center justify-between transition ${
                  settings.showSafeBorderGuide
                    ? 'bg-neutral-800 text-white border-neutral-600 font-medium'
                    : 'bg-neutral-950 text-neutral-400 border-neutral-800'
                }`}
              >
                <span>Borda Azul Guia</span>
                {settings.showSafeBorderGuide ? (
                  <CheckSquare className="w-4 h-4 text-blue-400" />
                ) : (
                  <Square className="w-4 h-4 text-neutral-600" />
                )}
              </button>
            </div>

            {/* Font Family Selection */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-neutral-300 font-medium">
                Fonte da Apresentação
              </label>
              <div className="grid grid-cols-3 gap-1.5 text-xs">
                {[
                  { id: 'arial-black', label: 'Arial Black' },
                  { id: 'inter', label: 'Inter Heavy' },
                  { id: 'arial', label: 'Arial Bold' },
                ].map(f => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() =>
                      setSettings(prev => ({ ...prev, fontFamily: f.id as any }))
                    }
                    className={`px-2 py-1.5 rounded text-xs text-center border transition ${
                      settings.fontFamily === f.id
                        ? 'bg-white text-black border-white font-bold'
                        : 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:border-neutral-600'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Line Height (Espaçamento entre linhas) */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-neutral-300 font-medium">
                Espaçamento Entre Linhas (Entrelinha)
              </label>
              <div className="grid grid-cols-3 gap-1.5 text-xs">
                {[
                  { label: 'Compacta (1.14)', val: 1.14 },
                  { label: 'Padrão (1.18)', val: 1.18 },
                  { label: 'Espaçada (1.28)', val: 1.28 },
                ].map(opt => (
                  <button
                    key={opt.val}
                    type="button"
                    onClick={() =>
                      setSettings(prev => ({ ...prev, lineHeight: opt.val }))
                    }
                    className={`px-2 py-1.5 rounded text-xs text-center border transition ${
                      settings.lineHeight === opt.val
                        ? 'bg-white text-black border-white font-bold'
                        : 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:border-neutral-600'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Safe Margin Selection */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-300 font-medium">
                  Borda de Segurança (Margem da Caixa)
                </span>
                <span className="font-mono text-white bg-neutral-800 px-2 py-0.5 rounded text-[11px]">
                  {settings.safeMarginPercent}%
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { label: '4% (Ultra)', val: 4 },
                  { label: '5% (Padrão Exemplo)', val: 5 },
                  { label: '8% (Com Margem)', val: 8 },
                ].map(opt => (
                  <button
                    key={opt.val}
                    type="button"
                    onClick={() =>
                      setSettings(prev => ({ ...prev, safeMarginPercent: opt.val }))
                    }
                    className={`px-2 py-1.5 rounded text-xs text-center border transition ${
                      settings.safeMarginPercent === opt.val
                        ? 'bg-white text-black border-white font-medium'
                        : 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:border-neutral-600'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Font Size Slider with Immediate Visual Feedback */}
            <div className="flex flex-col gap-1.5 bg-neutral-950/70 p-2.5 rounded-lg border border-neutral-800">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-300 font-medium">
                  Tamanho da Letra (Ajuste Direto)
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-white bg-neutral-800 px-2 py-0.5 rounded text-[11px] font-bold">
                    {settings.fontSizePt} pt
                  </span>
                  {!settings.autoFitMaxSpace && (
                    <span className="text-[10px] text-amber-400 bg-amber-950/80 px-1 rounded">
                      Manual
                    </span>
                  )}
                </div>
              </div>
              <input
                type="range"
                min={30}
                max={90}
                step={1}
                value={settings.fontSizePt}
                onChange={e => {
                  const val = Number(e.target.value);
                  setSettings(prev => ({
                    ...prev,
                    fontSizePt: val,
                    autoFitMaxSpace: false, // Switching to direct manual control when slider is moved
                  }));
                }}
                className="w-full accent-blue-500 h-2 bg-neutral-800 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between items-center text-[10px] text-neutral-400 pt-0.5">
                <span>30pt (Menor)</span>
                <button
                  type="button"
                  onClick={() =>
                    setSettings(prev => ({ ...prev, autoFitMaxSpace: true }))
                  }
                  className="text-blue-400 hover:text-blue-300 underline font-semibold flex items-center gap-0.5"
                >
                  <Sparkles className="w-3 h-3" />
                  Preencher Caixa Máximo (Auto)
                </button>
                <span>90pt (Maior)</span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Live Projector Slide Preview */}
        <div
          className={`md:col-span-7 lg:col-span-7 flex flex-col gap-4 ${
            mobileTab === 'editor' ? 'hidden md:flex' : 'flex'
          }`}
        >
          {/* Main Slide Preview Box */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 sm:p-5 flex flex-col gap-3">
            {/* Slide Header Info */}
            <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
                  Prévia do Slide {currentSlideIndex + 1} de {slides.length}
                </span>
                {activeSlide?.type === 'title' ? (
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">
                    Slide 1: Título & Autor
                  </span>
                ) : (
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                    Texto Corrido com Vírgula
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsPresentationOpen(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700 transition"
                  title="Abrir este slide em tela cheia (F11)"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Tela Cheia</span>
                </button>
              </div>
            </div>

            {/* Warning banner when active slide overflows safe box */}
            {activeSlide?.overflows && (
              <div className="px-3.5 py-2.5 rounded-lg bg-red-950/90 border-2 border-red-500 text-red-100 text-xs flex items-center justify-between shadow-lg">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 animate-bounce" />
                  <div>
                    <span className="font-bold text-red-200 block text-xs">
                      ⚠️ Este Slide ({currentSlideIndex + 1}) estourou a área visível ({activeSlide.overflowPercent}% do espaço)!
                    </span>
                    <span className="text-red-300/80 block text-[11px]">
                      {activeSlide.overflowReason || 'O texto ultrapassa a borda azul e corta no projetor.'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleSplitSlide(currentSlideIndex)}
                  className="px-3 py-1.5 rounded bg-red-500 hover:bg-red-400 text-black font-bold text-xs shrink-0 flex items-center gap-1 shadow transition ml-2"
                  title="Dividir este slide ao meio inserindo '---'"
                >
                  <Scissors className="w-3.5 h-3.5" />
                  Dividir Slide
                </button>
              </div>
            )}

            {/* The Actual Slide Canvas (Strictly pure text, zero icons or images) */}
            <div className="w-full bg-black rounded-lg overflow-hidden border border-neutral-800 shadow-2xl relative group">
              <SlideCanvas
                key={`${activeSlide.id}-${settings.fontSizePt}-${settings.lineHeight}-${settings.safeMarginPercent}-${settings.textAlign}-${settings.fontFamily}-${settings.theme}-${settings.autoFitMaxSpace}-${settings.textTransform}-${settings.addCommasToPhrases}`}
                slide={activeSlide}
                settings={settings}
                isPresentationMode={false}
                showBoundingGuide={settings.showSafeBorderGuide}
              />

              {/* Navigation overlays on hover */}
              <button
                type="button"
                onClick={() => setCurrentSlideIndex(prev => Math.max(0, prev - 1))}
                disabled={currentSlideIndex === 0}
                className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 hover:bg-black/90 text-white disabled:opacity-0 transition-opacity"
                title="Slide Anterior"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={() =>
                  setCurrentSlideIndex(prev => Math.min(slides.length - 1, prev + 1))
                }
                disabled={currentSlideIndex === slides.length - 1}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 hover:bg-black/90 text-white disabled:opacity-0 transition-opacity"
                title="Próximo Slide"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Slide Navigation Bar */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setCurrentSlideIndex(prev => Math.max(0, prev - 1))}
                disabled={currentSlideIndex === 0}
                className="px-3 py-1.5 text-xs font-medium rounded-md bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 text-neutral-200 border border-neutral-700 transition flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Anterior</span>
              </button>

              <div className="flex items-center gap-2 text-xs font-mono text-neutral-400">
                <button
                  type="button"
                  onClick={() => setCurrentSlideIndex(0)}
                  className="hover:text-white underline text-[11px]"
                >
                  Slide 1 (Título)
                </button>
                <span>•</span>
                <span className="text-white font-semibold">
                  {currentSlideIndex + 1} / {slides.length}
                </span>
                <span>•</span>
                <button
                  type="button"
                  onClick={() => setCurrentSlideIndex(slides.length - 1)}
                  className="hover:text-white underline text-[11px]"
                >
                  Fim
                </button>
              </div>

              <button
                type="button"
                onClick={() =>
                  setCurrentSlideIndex(prev => Math.min(slides.length - 1, prev + 1))
                }
                disabled={currentSlideIndex === slides.length - 1}
                className="px-3 py-1.5 text-xs font-medium rounded-md bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 text-neutral-200 border border-neutral-700 transition flex items-center gap-1"
              >
                <span>Próximo</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Miniature Slide Carousel / Thumbnails Grid */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
                Todos os Slides Gerados ({slides.length})
              </span>
              <span className="text-[11px] text-neutral-400">
                Texto corrido com vírgula em MAIÚSCULAS
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-2.5 max-h-[380px] overflow-y-auto pr-1">
              {slides.map((s, idx) => {
                const isActive = idx === currentSlideIndex;
                const displayText = s.continuousText || s.lines.join(' ');

                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setCurrentSlideIndex(idx)}
                    className={`relative text-left rounded-lg p-2.5 transition flex flex-col justify-between border select-none ${
                      isActive
                        ? s.overflows
                          ? 'bg-red-950/60 border-red-500 ring-2 ring-red-500'
                          : 'bg-neutral-950 border-white ring-1 ring-white'
                        : s.overflows
                          ? 'bg-red-950/30 border-red-500/80 hover:border-red-400'
                          : 'bg-neutral-950/70 border-neutral-800 hover:border-neutral-600'
                    }`}
                    style={{ minHeight: '92px' }}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-neutral-800 text-neutral-300">
                        {idx + 1}
                      </span>
                      {s.type === 'title' ? (
                        <span className="text-[9px] uppercase font-mono px-1 rounded bg-blue-950 text-blue-300">
                          Capa
                        </span>
                      ) : s.overflows ? (
                        <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-red-600 text-white font-bold flex items-center gap-0.5 animate-pulse">
                          ⚠️ Estourou ({s.overflowPercent}%)
                        </span>
                      ) : null}
                    </div>

                    {s.type === 'title' ? (
                      <div className="flex flex-col items-center justify-center my-auto text-center w-full uppercase">
                        <span className="font-extrabold text-xs text-white truncate max-w-full">
                          {s.title}
                        </span>
                        <span className="text-[10px] text-neutral-400 truncate max-w-full font-medium">
                          {s.artist}
                        </span>
                      </div>
                    ) : (
                      <div className="text-[10px] font-extrabold leading-tight text-neutral-200 line-clamp-3 uppercase">
                        {displayText}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </main>

      {/* Presentation Fullscreen Modal */}
      <PresentationModal
        slides={slides}
        settings={settings}
        initialSlideIndex={currentSlideIndex}
        isOpen={isPresentationOpen}
        onClose={() => setIsPresentationOpen(false)}
        onSlideChange={index => setCurrentSlideIndex(index)}
      />

      {/* Footer minimal info */}
      <footer className="border-t border-neutral-900 bg-neutral-950 py-3 px-4 text-center text-xs text-neutral-500">
        Letras Projetor • Configurado em Arial Black MAIÚSCULA, vírgulas nas frases e preenchimento máximo sem ultrapassar bordas
      </footer>
    </div>
  );
}
