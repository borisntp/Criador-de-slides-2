import { SlideItem, SlideSettings } from '../types';

/**
 * Copies slides formatted for pasting into Google Slides or presentation software
 */
export function formatSlidesForClipboard(slides: SlideItem[]): string {
  return slides
    .map((slide, i) => {
      if (slide.type === 'title') {
        return `[SLIDE 1 - TÍTULO]\n${(slide.title || '').toUpperCase()}\n${(slide.artist || '').toUpperCase()}\n`;
      }
      const text = (slide.continuousText || slide.lines.join(' ')).toUpperCase();
      return `[SLIDE ${i + 1}]\n${text}\n`;
    })
    .join('\n---\n\n');
}

/**
 * Generates a standalone, offline single-file HTML presentation with auto-fit maximizing the text box
 */
export function exportStandaloneHtml(
  title: string,
  artist: string,
  slides: SlideItem[],
  settings: SlideSettings
): string {
  const slidesJson = JSON.stringify(slides);
  const settingsJson = JSON.stringify(settings);

  const fontCss = settings.fontFamily === 'arial-black'
    ? "'Arial Black', Impact, sans-serif"
    : settings.fontFamily === 'inter'
    ? "'Inter', sans-serif"
    : "Arial, Helvetica, sans-serif";
  const fontWeightCss = settings.fontFamily === 'arial-black' ? 900 : 700;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title.toUpperCase()} - ${artist.toUpperCase()} (Projetor)</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body, html {
      width: 100%; height: 100%; overflow: hidden;
      background: #000; color: #fff;
      font-family: ${fontCss};
      font-weight: ${fontWeightCss};
      user-select: none;
    }
    #stage {
      width: 100vw; height: 100vh;
      display: flex; align-items: center; justify-content: center;
      background: #000;
    }
    .text-box {
      width: ${100 - settings.safeMarginPercent * 2}vw;
      height: ${100 - settings.safeMarginPercent * 2}vh;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      text-align: ${settings.textAlign};
      text-transform: ${settings.textTransform};
      overflow: hidden;
    }
    .title-main {
      font-weight: ${fontWeightCss}; line-height: 1.15;
      text-transform: uppercase;
      word-break: break-word;
    }
    .title-sub {
      font-weight: 600; color: rgba(255,255,255,0.65);
      letter-spacing: 0.05em;
      text-transform: uppercase;
      margin-top: 0.5em;
    }
    .lyric-lines {
      width: 100%;
      font-weight: ${fontWeightCss}; line-height: 1.16;
      text-transform: uppercase;
      word-break: break-word;
      letter-spacing: -0.015em;
    }
    #counter {
      position: fixed; bottom: 12px; right: 16px;
      font-size: 12px; color: rgba(255,255,255,0.4);
      font-family: monospace;
      pointer-events: none;
    }
  </style>
</head>
<body>
  <div id="stage">
    <div id="content" class="text-box"></div>
  </div>
  <div id="counter"></div>

  <script>
    const slides = ${slidesJson};
    let current = 0;
    let blackout = false;

    function autoFit(el, maxW, maxH) {
      let low = 16;
      let high = maxH * 0.40;
      let best = low;
      for (let i = 0; i < 14; i++) {
        let mid = (low + high) / 2;
        el.style.fontSize = mid + 'px';
        if (el.scrollWidth <= maxW * 0.985 && el.scrollHeight <= maxH * 0.985) {
          best = mid;
          low = mid + 0.4;
        } else {
          high = mid - 0.4;
        }
      }
      el.style.fontSize = best + 'px';
    }

    function render() {
      const content = document.getElementById('content');
      const counter = document.getElementById('counter');
      if (blackout) {
        content.innerHTML = '';
        counter.textContent = '[Tela Oculta - B]';
        return;
      }
      const s = slides[current];
      const boxW = content.clientWidth;
      const boxH = content.clientHeight;

      if (s.type === 'title') {
        content.innerHTML = '<div id="fit-text" class="title-main">' + (s.title || '') + '<div class="title-sub">' + (s.artist || '') + '</div></div>';
      } else {
        const text = s.continuousText || s.lines.join(' ');
        content.innerHTML = '<div id="fit-text" class="lyric-lines">' + text + '</div>';
      }
      const fitEl = document.getElementById('fit-text');
      if (fitEl) {
        autoFit(fitEl, boxW, boxH);
      }
      counter.textContent = (current + 1) + ' / ' + slides.length;
    }

    function next() { if (current < slides.length - 1) { current++; render(); } }
    function prev() { if (current > 0) { current--; render(); } }

    window.addEventListener('resize', render);
    window.addEventListener('keydown', e => {
      if (['ArrowRight', 'ArrowDown', ' ', 'PageDown', 'Enter'].includes(e.key)) { e.preventDefault(); next(); }
      else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); prev(); }
      else if (e.key === 'Home') { current = 0; render(); }
      else if (e.key === 'End') { current = slides.length - 1; render(); }
      else if (e.key === 'b' || e.key === 'B') { blackout = !blackout; render(); }
      else if (e.key === 'f' || e.key === 'F') {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
        else document.exitFullscreen().catch(() => {});
      }
    });

    window.addEventListener('click', e => {
      if (e.clientX > window.innerWidth / 2) next();
      else prev();
    });

    render();
  </script>
</body>
</html>`;
}
