import { SlideItem, SlideSettings } from '../types';

interface CreatePresentationOptions {
  accessToken: string;
  songTitle: string;
  songArtist: string;
  slides: SlideItem[];
  settings: SlideSettings;
}

export interface CreatedPresentationResult {
  presentationId: string;
  presentationUrl: string;
}

function getRgbColor(theme: string): {
  bg: { red: number; green: number; blue: number };
  text: { red: number; green: number; blue: number };
  artist: { red: number; green: number; blue: number };
} {
  switch (theme) {
    case 'yellow':
      return {
        bg: { red: 0, green: 0, blue: 0 },
        text: { red: 1, green: 0.92, blue: 0.23 }, // #ffeb3b
        artist: { red: 0.9, green: 0.85, blue: 0.3 },
      };
    case 'white':
      return {
        bg: { red: 1, green: 1, blue: 1 },
        text: { red: 0, green: 0, blue: 0 },
        artist: { red: 0.4, green: 0.4, blue: 0.4 },
      };
    case 'dark':
      return {
        bg: { red: 0.06, green: 0.09, blue: 0.16 }, // #0f172a
        text: { red: 0.97, green: 0.98, blue: 0.99 },
        artist: { red: 0.65, green: 0.7, blue: 0.75 },
      };
    case 'black':
    default:
      return {
        bg: { red: 0, green: 0, blue: 0 },
        text: { red: 1, green: 1, blue: 1 },
        artist: { red: 0.7, green: 0.7, blue: 0.7 },
      };
  }
}

function getFontFamilyName(fontFamily: string): string {
  switch (fontFamily) {
    case 'inter':
      return 'Inter';
    case 'arial-black':
      return 'Arial Black';
    case 'arial':
    default:
      return 'Arial';
  }
}

/**
 * Computes the exact optimal font size in points for a given set of lines,
 * accounting for character width factors,
 * so it NEVER overflows the safe margins of a Google Slides widescreen page.
 */
function computeGoogleSlidesFittingFontSize(
  lines: string[],
  settings: SlideSettings,
  availWidthPt: number = 648,
  availHeightPt: number = 364.5
): number {
  const lineHeight = Math.max(1.22, settings.lineHeight || 1.16);
  const userRequestedPt = Math.min(54, settings.fontSizePt || 54);
  const isArialBlack = settings.fontFamily === 'arial-black';

  if (!lines || lines.length === 0) return userRequestedPt;

  // Arial Black uppercase is ~0.75 width factor; standard Arial/Inter is ~0.65
  const charWidthFactor = isArialBlack ? 0.75 : 0.65;

  const continuousText = lines.join(' ').trim();
  const words = continuousText.split(/\s+/).filter(Boolean);
  if (words.length === 0) return userRequestedPt;

  let maxFittingPt = 18;

  for (let fPt = 54; fPt >= 18; fPt--) {
    const charWidthPt = fPt * charWidthFactor;
    const maxCharsPerLine = Math.max(6, Math.floor(availWidthPt / charWidthPt));

    let totalVisualLines = 1;
    let currentLineChars = 0;
    let wordOverflows = false;

    for (const w of words) {
      if (w.length * charWidthPt > availWidthPt) {
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

    const totalHeightPt = totalVisualLines * (fPt * lineHeight);
    if (totalHeightPt <= availHeightPt * 0.90) {
      maxFittingPt = fPt;
      break;
    }
  }

  if (settings.autoFitMaxSpace) {
    return Math.min(userRequestedPt, maxFittingPt);
  } else {
    return Math.min(userRequestedPt, maxFittingPt);
  }
}

/**
 * Creates a native Google Slides presentation directly in the user's active Google account,
 * dynamically fitting font size, zeroing internal shape margins, enabling TEXT_AUTOFIT,
 * and vertically centering text for 100% precision without boundary overflow.
 */
export async function createGoogleSlidesPresentation({
  accessToken,
  songTitle,
  songArtist,
  slides,
  settings,
}: CreatePresentationOptions): Promise<CreatedPresentationResult> {
  const titleText = (songTitle || 'Música').toUpperCase();
  const artistText = (songArtist || 'Artista').toUpperCase();
  const presentationName = `${titleText} - ${artistText}`;

  // 1. Create a new Google Presentation
  const createRes = await fetch('https://slides.googleapis.com/v1/presentations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: presentationName,
    }),
  });

  if (!createRes.ok) {
    const errData = await createRes.json().catch(() => ({}));
    throw new Error(
      errData.error?.message ||
        `Falha ao criar apresentação no Google Slides (Status ${createRes.status}).`
    );
  }

  const presentationData = await createRes.json();
  const presentationId = presentationData.presentationId;
  const defaultInitialSlideId = presentationData.slides?.[0]?.objectId;

  // 2. Dimensions for standard 16:9 widescreen in Google Slides (720pt x 405pt)
  // 1 pt = 12700 EMU
  const pageWidthPt = 720;
  const pageHeightPt = 405;
  const pageWidthEmu = 9144000;
  const pageHeightEmu = 5143500;

  const marginPercent = Math.max(4, settings.safeMarginPercent || 5) / 100;
  const marginXEmu = Math.round(pageWidthEmu * marginPercent);
  const marginYEmu = Math.round(pageHeightEmu * marginPercent);
  const textWidthEmu = pageWidthEmu - 2 * marginXEmu;
  const textHeightEmu = pageHeightEmu - 2 * marginYEmu;

  const availWidthPt = pageWidthPt * (1 - 2 * marginPercent);
  const availHeightPt = pageHeightPt * (1 - 2 * marginPercent);

  const colors = getRgbColor(settings.theme);
  const fontFamily = getFontFamilyName(settings.fontFamily);
  const lineHeightPercent = Math.round((Math.max(1.22, settings.lineHeight || 1.16)) * 100);

  const requests: any[] = [];
  const createdSlideObjectIds: string[] = [];

  slides.forEach((slideItem, index) => {
    const slideObjectId = `slide_${index}_${Date.now()}`;
    createdSlideObjectIds.push(slideObjectId);

    // Create a blank slide
    requests.push({
      createSlide: {
        objectId: slideObjectId,
        insertionIndex: index,
        slideLayoutReference: {
          predefinedLayout: 'BLANK',
        },
      },
    });

    // Set solid page background color
    requests.push({
      updatePageProperties: {
        objectId: slideObjectId,
        pageProperties: {
          pageBackgroundFill: {
            solidFill: {
              color: { rgbColor: colors.bg },
            },
          },
        },
        fields: 'pageBackgroundFill.solidFill.color',
      },
    });

    // Create Text Box Shape covering safe area
    const shapeObjectId = `textbox_${index}_${Date.now()}`;

    requests.push({
      createShape: {
        objectId: shapeObjectId,
        shapeType: 'TEXT_BOX',
        elementProperties: {
          pageObjectId: slideObjectId,
          size: {
            width: { magnitude: textWidthEmu, unit: 'EMU' },
            height: { magnitude: textHeightEmu, unit: 'EMU' },
          },
          transform: {
            scaleX: 1,
            scaleY: 1,
            translateX: marginXEmu,
            translateY: marginYEmu,
            unit: 'EMU',
          },
        },
      },
    });

    // Configure shape properties: vertical middle alignment
    requests.push({
      updateShapeProperties: {
        objectId: shapeObjectId,
        shapeProperties: {
          contentAlignment: 'MIDDLE',
        },
        fields: 'contentAlignment',
      },
    });

    if (slideItem.type === 'title') {
      // Slide 1: Title + Artist
      const displayTitle = (slideItem.title || titleText).toUpperCase();
      const displayArtist = (slideItem.artist || artistText).toUpperCase();
      const fullText = `${displayTitle}\n\n${displayArtist}`;

      requests.push({
        insertText: {
          objectId: shapeObjectId,
          text: fullText,
        },
      });

      // Paragraph center alignment
      requests.push({
        updateParagraphStyle: {
          objectId: shapeObjectId,
          textRange: { type: 'ALL' },
          style: {
            alignment: 'CENTER',
            lineSpacing: 115,
          },
          fields: 'alignment,lineSpacing',
        },
      });

      // Title font sizing
      const titleLen = displayTitle.length;
      const titleFontSize = Math.min(
        48,
        Math.max(26, Math.floor((availWidthPt / (titleLen * 0.72)) * 0.95))
      );

      requests.push({
        updateTextStyle: {
          objectId: shapeObjectId,
          textRange: {
            type: 'FIXED_RANGE',
            startIndex: 0,
            endIndex: titleLen,
          },
          style: {
            fontFamily: fontFamily,
            fontSize: { magnitude: titleFontSize, unit: 'PT' },
            bold: true,
            foregroundColor: {
              opaqueColor: { rgbColor: colors.text },
            },
          },
          fields: 'fontFamily,fontSize,bold,foregroundColor',
        },
      });

      // Artist text style (discrete)
      if (displayArtist) {
        const artistStartIndex = titleLen + 2; // after \n\n
        const artistEndIndex = fullText.length;
        requests.push({
          updateTextStyle: {
            objectId: shapeObjectId,
            textRange: {
              type: 'FIXED_RANGE',
              startIndex: artistStartIndex,
              endIndex: artistEndIndex,
            },
            style: {
              fontFamily: fontFamily === 'Arial Black' ? 'Arial' : fontFamily,
              fontSize: { magnitude: Math.round(titleFontSize * 0.42), unit: 'PT' },
              bold: true,
              foregroundColor: {
                opaqueColor: { rgbColor: colors.artist },
              },
            },
            fields: 'fontFamily,fontSize,bold,foregroundColor',
          },
        });
      }
    } else {
      // Lyrics Slides: render as single fluid continuous text block (phrases joined with spaces)
      const displayLines = slideItem.lines && slideItem.lines.length > 0
        ? slideItem.lines
        : (slideItem.continuousText || '').split(/\s+/).filter(Boolean);

      const lyricsContent = (slideItem.continuousText || displayLines.join(' ')).toUpperCase();
      const slideFontSizePt = computeGoogleSlidesFittingFontSize(
        displayLines,
        settings,
        availWidthPt,
        availHeightPt
      );

      requests.push({
        insertText: {
          objectId: shapeObjectId,
          text: lyricsContent,
        },
      });

      // Alignment & Line Spacing
      requests.push({
        updateParagraphStyle: {
          objectId: shapeObjectId,
          textRange: { type: 'ALL' },
          style: {
            alignment: settings.textAlign === 'left' ? 'LEFT' : 'CENTER',
            lineSpacing: lineHeightPercent,
          },
          fields: 'alignment,lineSpacing',
        },
      });

      // Font style for lyrics
      requests.push({
        updateTextStyle: {
          objectId: shapeObjectId,
          textRange: { type: 'ALL' },
          style: {
            fontFamily: fontFamily,
            fontSize: { magnitude: slideFontSizePt, unit: 'PT' },
            bold: true,
            foregroundColor: {
              opaqueColor: { rgbColor: colors.text },
            },
          },
          fields: 'fontFamily,fontSize,bold,foregroundColor',
        },
      });
    }
  });

  // Delete default initial placeholder slide created by Google API
  if (defaultInitialSlideId) {
    requests.push({
      deleteObject: {
        objectId: defaultInitialSlideId,
      },
    });
  }

  // 3. Send batchUpdate request to Google Slides API
  const batchRes = await fetch(
    `https://slides.googleapis.com/v1/presentations/${presentationId}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests }),
    }
  );

  if (!batchRes.ok) {
    const errData = await batchRes.json().catch(() => ({}));
    throw new Error(
      errData.error?.message ||
        `Falha ao formatar slides no Google Slides (Status ${batchRes.status}).`
    );
  }

  const presentationUrl = `https://docs.google.com/presentation/d/${presentationId}/edit`;

  return {
    presentationId,
    presentationUrl,
  };
}
