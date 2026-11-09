import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

interface FetchLyricsRequest {
  url?: string;
  query?: string;
}

/**
 * Cleans and formats markdown lyrics fetched via reader proxy into clean slide-ready text
 */
function cleanLyricsMarkdown(text: string): { title: string; artist: string; lyrics: string } {
  // Title extraction: "Title: O Escudo - Voz da Verdade - LETRAS.MUS.BR"
  const titleMatch = text.match(/Title:\s*(.+?)\s*-\s*(.+?)\s*-\s*LETRAS\.MUS\.BR/i);
  let title = titleMatch ? titleMatch[1].trim() : '';
  let artist = titleMatch ? titleMatch[2].trim() : '';

  // Extract content after "Markdown Content:"
  const contentIdx = text.indexOf('Markdown Content:');
  let body = contentIdx !== -1 ? text.slice(contentIdx + 17) : text;

  // Remove language links, translations, headers, etc.
  body = body
    .replace(/\*?\s*\[(Espanhol|Inglês|Francês|Italiano|Alemão|Holandês|Tradução)[^\]]*\]\([^\)]+\)/gi, '')
    .replace(/\*?\s*\[.*?\]\(.*?\)/g, '')
    .replace(/^#+\s+.*$/gm, '')
    .replace(/Adicionar aos favoritos.*$/si, '')
    .replace(/Tamanho do texto.*$/si, '')
    .replace(/Mais acessadas.*$/si, '')
    .replace(/Letras\.mus\.br.*$/si, '');

  // Split lines and preserve stanza spacing
  const rawLines = body
    .replace(/\r\n/g, '\n')
    .split(/\n/)
    .map(l => l.replace(/^[*\s]+/, '').trim());

  // Filter out noisy navigation lines
  const cleanLines: string[] = [];
  for (const line of rawLines) {
    if (!line) {
      if (cleanLines.length > 0 && cleanLines[cleanLines.length - 1] !== '') {
        cleanLines.push('');
      }
      continue;
    }
    if (
      line.startsWith('Menu') ||
      line.startsWith('Voltar') ||
      line.startsWith('Buscar') ||
      line.startsWith('Conta') ||
      line.startsWith('Entrar') ||
      line.includes('Página inicial') ||
      line.includes('Compartilhar')
    ) {
      continue;
    }
    cleanLines.push(line);
  }

  const lyrics = cleanLines.join('\n').trim();

  // If title was not extracted from "Title: ...", check for first heading
  if (!title) {
    const headingMatch = text.match(/#\s*(.+)/);
    if (headingMatch) {
      title = headingMatch[1].trim();
    }
  }

  return { title, artist, lyrics };
}

/**
 * Server endpoint to fetch lyrics from Letras.mus.br or external query
 */
app.post('/api/lyrics', async (req, res) => {
  try {
    const { url, query } = req.body as FetchLyricsRequest;
    const input = (url || query || '').trim();

    if (!input) {
      return res.status(400).json({ error: 'URL ou termo de busca não informado.' });
    }

    // 1. If it's a Letras.mus.br link (with numeric ID or slug)
    if (input.includes('letras.mus.br')) {
      let targetUrl = input;
      if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        targetUrl = 'https://' + targetUrl;
      }

      try {
        const jinaUrl = `https://r.jina.ai/${targetUrl}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 7000);

        const jinaRes = await fetch(jinaUrl, {
          signal: controller.signal,
          headers: {
            Accept: 'text/plain',
            'X-Target-Selector': 'article, .cnt-letra, .lyric, main',
          },
        });
        clearTimeout(timeoutId);

        if (jinaRes.ok) {
          const rawText = await jinaRes.text();
          const parsed = cleanLyricsMarkdown(rawText);

          if (parsed.lyrics && parsed.lyrics.length > 30) {
            return res.json({
              title: parsed.title || 'Música',
              artist: parsed.artist || 'Artista',
              lyrics: parsed.lyrics,
              source: 'Letras.mus.br',
            });
          }
        }
      } catch (err) {
        console.warn('Jina proxy fetch error:', err);
      }
    }

    // 2. Query LRCLIB public API for track
    try {
      const searchRes = await fetch(
        `https://lrclib.net/api/search?q=${encodeURIComponent(input)}`,
        {
          headers: {
            'User-Agent': 'LetrasProjetor/1.0',
          },
        }
      );

      if (searchRes.ok) {
        const data = await searchRes.json();
        if (Array.isArray(data) && data.length > 0) {
          // Find first track with plainLyrics
          const match = data.find(item => Boolean(item.plainLyrics));
          if (match) {
            return res.json({
              title: match.trackName,
              artist: match.artistName,
              lyrics: match.plainLyrics.trim(),
              source: 'lrclib.net / Letras',
            });
          }
        }
      }
    } catch (err) {
      console.warn('LRCLIB search error:', err);
    }

    return res.status(404).json({
      error: 'Não foi possível encontrar a letra automaticamente. Você pode colar o texto no editor ao lado.',
    });
  } catch (error: any) {
    console.error('API /lyrics error:', error);
    res.status(500).json({ error: error.message || 'Erro interno ao buscar letra.' });
  }
});

// Start server and mount Vite middlewares in development
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production: serve static build
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Letras Projetor server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
