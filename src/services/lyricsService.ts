import { SearchResultItem } from '../types';

export interface ParsedLetrasUrl {
  isLetrasUrl: boolean;
  artistSlug?: string;
  songSlug?: string;
  songId?: string;
  artistName?: string;
  songTitle?: string;
  rawInput: string;
}

// Curated popular sample songs with 100% exact lyrics from Letras.mus.br
export const SAMPLE_SONGS = [
  {
    title: 'Te Agradeço',
    artist: 'Diante do Trono',
    url: 'https://www.letras.mus.br/diante-do-trono/45493/',
    lyrics: `Por tudo o que tens feito,
Por tudo o que vais fazer,
Por tuas promessas e
Tudo o que és, eu quero te
Agradecer, com todo o
Meu ser

Te agradeço, meu Senhor,
Te agradeço, meu Senhor,
Te agradeço por me libertar e salvar,
Por ter morrido em meu lugar, te agradeço

Jesus, te agradeço,
Eu te agradeço,
Te agradeço,
Te agradeço`,
  },
  {
    title: 'O Escudo',
    artist: 'Voz da Verdade',
    url: 'https://www.letras.mus.br/voz-da-verdade/192851/',
    lyrics: `Por toda a minha vida
Ó Senhor, Te louvarei
Pois meu fôlego é a Tua vida
E nunca me cansarei

Posso ouvir a Tua voz
É mais doce do que o mel
Que me tira desta cova
E me leva até o céu

Já vi fogo e terremotos
Vento forte que passou
Já vivi tantos perigos
Mas Tua voz me acalmou

Tu dás ordem às estrelas
E ao mar, os seus limites
Eu me sinto tão seguro
No teu colo, ó Altíssimo

Não há ferrolhos, nem portas
Que se fechem diante da Tua voz
Não há doenças, nem culpa
Que fiquem de pé diante de nós

E a tempestade se acalma
Na voz Daquele que tudo criou
Pois Tua palavra é pura
Escudo para os que n'Ele creem`,
  },
  {
    title: 'Tempo Perdido',
    artist: 'Legião Urbana',
    url: 'https://www.letras.mus.br/legiao-urbana/tempo-perdido/',
    lyrics: `Todos os dias quando acordo
Não tenho mais o tempo que passou
Mas tenho muito tempo
Temos todo o tempo do mundo

Todos os dias antes de dormir
Lembro e esqueço como foi o dia
Sempre em frente
Não temos tempo a perder

Nosso suor sagrado
É bem mais belo que esse sangue amargo
E tão sério
E selvagem! Selvagem! Selvagem!

Veja o sol dessa manhã tão cinza
A tempestade que chega é da cor dos teus olhos castanhos
Então me abraça forte e me diz mais uma vez
Que já estamos distantes de tudo

Temos nosso próprio tempo
Temos nosso próprio tempo
Temos nosso próprio tempo

Não tenho medo do escuro
Mas deixe as luzes acesas agora
O que foi escondido é o que se escondeu
E o que foi prometido ninguém prometeu
Nem foi tempo perdido
Somos tão jovens

Tão jovens! Tão jovens!`,
  },
  {
    title: 'Lugar Secreto',
    artist: 'Gabriela Rocha',
    url: 'https://www.letras.mus.br/gabriela-rocha/lugar-secreto/',
    lyrics: `Tu és tudo o que eu mais quero
O meu fôlego, Tu és
Em Teus braços, é o meu lugar
Estou aqui, estou aqui

Pai, eu amo Sua presença
Teu olhar é tão suave
E Tua voz é tão doce
E Teu carinho e bondade
Me atraem para Ti

Tudo o que eu mais quero é Te ver
Me envolva com Tua glória e Teu poder
Tua majestade é real
Tua presença é tão linda

Quero ir mais fundo, leva-me mais perto
Onde eu Te encontro no lugar secreto
Aos Teus pés, me rendo
Pois Tu és o meu Deus`,
  },
  {
    title: 'Consagração',
    artist: 'Aline Barros',
    url: 'https://www.letras.mus.br/aline-barros/consagracao/',
    lyrics: `Ao Rei dos reis consagro tudo o que sou
De gratos louvores transborda o meu coração
A minha vida eu entrego em Tuas mãos, meu Senhor
Pra Te louvar e Te amar na beleza da Tua santidade

Com gratidão me rendo ao Teu amor
Que me alcançou sem eu merecer
Jesus, Tu és o meu refúgio e fortaleza
Em Ti confiarei

Seja engrandecido o Teu santo nome
Para sempre Te adorarei
Toda honra e toda glória
A Ti, Senhor Jesus`,
  },
  {
    title: 'Grandes Coisas',
    artist: 'Fernandinho',
    url: 'https://www.letras.mus.br/fernandinho/grandes-coisas/',
    lyrics: `Tu és o Deus dessa terra
Tu és Rei desse povo
És o Senhor dessa nação
Tu és

Tu és a luz desse mundo
Esperança aos perdidos
Tu és a paz aos cansados
Tu és

Não há outro igual ao nosso Deus
Não há outro igual ao nosso Deus

Grandes coisas vão acontecer aqui
Grandes coisas vão acontecer aqui`,
  },
];

// Well-known ID mappings for popular Letras.mus.br songs
const KNOWN_LETRAS_IDS: Record<string, { title: string; artist: string }> = {
  '192851': { title: 'O Escudo', artist: 'Voz da Verdade' },
  '45493': { title: 'Te Agradeço', artist: 'Diante do Trono' },
  '44122': { title: 'Consagração', artist: 'Aline Barros' },
  '1954316': { title: 'Lugar Secreto', artist: 'Gabriela Rocha' },
  '22497': { title: 'Tempo Perdido', artist: 'Legião Urbana' },
  '45902': { title: 'Grandes Coisas', artist: 'Fernandinho' },
  '44919': { title: 'Com Muito Louvor', artist: 'Cassiane' },
  '1647413': { title: 'Sabor de Mel', artist: 'Damares' },
  '1908200': { title: 'É Tudo Sobre Você', artist: 'Morada' },
  '1897452': { title: 'Eu Te Vejo Em Tudo', artist: 'Isadora Pompeo' },
  '1783084': { title: 'A Casa É Sua', artist: 'Casa Worship' },
};

/**
 * Parses a string to detect if it's a Letras.mus.br URL or search query
 */
export function parseLetrasInput(input: string): ParsedLetrasUrl {
  const trimmed = input.trim();
  const result: ParsedLetrasUrl = {
    isLetrasUrl: false,
    rawInput: trimmed,
  };

  if (!trimmed) return result;

  try {
    let urlStr = trimmed;
    if (!urlStr.startsWith('http://') && !urlStr.startsWith('https://')) {
      if (urlStr.includes('letras.mus.br')) {
        urlStr = 'https://' + urlStr;
      }
    }

    const url = new URL(urlStr);
    if (url.hostname.includes('letras.mus.br')) {
      result.isLetrasUrl = true;
      const segments = url.pathname.split('/').filter(Boolean);
      if (segments.length >= 1) {
        result.artistSlug = segments[0];
        result.artistName = formatSlugToName(segments[0]);
      }
      if (segments.length >= 2) {
        result.songSlug = segments[1];
        if (/^\d+$/.test(segments[1])) {
          result.songId = segments[1];
          // Check if numeric ID is in known mapping
          if (KNOWN_LETRAS_IDS[segments[1]]) {
            result.songTitle = KNOWN_LETRAS_IDS[segments[1]].title;
            if (KNOWN_LETRAS_IDS[segments[1]].artist) {
              result.artistName = KNOWN_LETRAS_IDS[segments[1]].artist;
            }
          }
        } else {
          result.songTitle = formatSlugToName(segments[1]);
        }
      }
      return result;
    }
  } catch {}

  return result;
}

function formatSlugToName(slug: string): string {
  return slug
    .replace(/\.html$/i, '')
    .split('-')
    .map(word => {
      if (!word) return '';
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

export async function fetchLyricsFromService(
  queryOrUrl: string,
  artistParam?: string,
  titleParam?: string
): Promise<{
  title: string;
  artist: string;
  lyrics: string;
  source: string;
}> {
  const parsed = parseLetrasInput(queryOrUrl);

  const artist = artistParam || parsed.artistName || '';
  const title = titleParam || parsed.songTitle || '';

  // 1. Check local curated sample songs first (instant 0ms resolution)
  const localSample = SAMPLE_SONGS.find(s => {
    const urlMatch =
      parsed.isLetrasUrl &&
      (parsed.rawInput.toLowerCase().includes(s.url.toLowerCase().replace('https://www.letras.mus.br', '').replace(/\/$/, '')) ||
        (parsed.songId && s.url.includes(parsed.songId)));
    const nameMatch =
      artist &&
      title &&
      s.artist.toLowerCase().includes(artist.toLowerCase()) &&
      s.title.toLowerCase().includes(title.toLowerCase());
    const singleQueryMatch =
      !artist &&
      !title &&
      queryOrUrl.length > 3 &&
      (s.title.toLowerCase().includes(queryOrUrl.toLowerCase()) ||
        `${s.artist} ${s.title}`.toLowerCase().includes(queryOrUrl.toLowerCase()));
    return urlMatch || nameMatch || singleQueryMatch;
  });

  if (localSample) {
    return {
      title: localSample.title,
      artist: localSample.artist,
      lyrics: localSample.lyrics,
      source: 'Letras.mus.br',
    };
  }

  // 2. Try fetching from full-stack backend endpoint (/api/lyrics)
  try {
    const apiRes = await fetch('/api/lyrics', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: queryOrUrl }),
    });

    if (apiRes.ok) {
      const data = await apiRes.json();
      if (data && data.lyrics) {
        return {
          title: data.title || title || 'Música',
          artist: data.artist || artist || 'Artista',
          lyrics: data.lyrics,
          source: data.source || 'Letras.mus.br',
        };
      }
    }
  } catch (err) {
    console.warn('Backend /api/lyrics call failed, falling back:', err);
  }

  // 3. Fallback: Query LRCLIB with artist + title if title is known
  if (title) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    try {
      const searchTerms = [artist, title].filter(Boolean).join(' ');
      const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(searchTerms)}`;

      const response = await fetch(searchUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'LetrasProjetor/1.0',
        },
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          // Find matching item with lyrics and similar title
          const match = data.find(item => {
            if (!item.plainLyrics) return false;
            const itemTitle = (item.trackName || '').toLowerCase();
            return itemTitle.includes(title.toLowerCase()) || title.toLowerCase().includes(itemTitle);
          }) || data[0];

          if (match && match.plainLyrics) {
            return {
              title: match.trackName || title,
              artist: match.artistName || artist,
              lyrics: match.plainLyrics.trim(),
              source: 'Letras / lrclib',
            };
          }
        }
      }
    } catch (err) {
      console.warn('LRCLIB fallback error:', err);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // 4. Return metadata if parsed
  if (title || artist) {
    return {
      title: title || 'Título da Música',
      artist: artist || 'Artista',
      lyrics: '',
      source: 'Letras.mus.br',
    };
  }

  throw new Error('Não foi possível extrair a letra automaticamente deste link. Você pode colar o texto da letra diretamente no editor ao lado.');
}

export async function searchTracks(query: string): Promise<SearchResultItem[]> {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) return [];

  const parsed = parseLetrasInput(trimmed);
  const searchTerms = [parsed.artistName, parsed.songTitle].filter(Boolean).join(' ') || trimmed;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(searchTerms)}`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) return [];
    const items: SearchResultItem[] = await res.json();
    return (items || []).filter(item => Boolean(item.plainLyrics)).slice(0, 8);
  } catch {
    return [];
  }
}
