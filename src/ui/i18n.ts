/**
 * The interface's texts, in Brazilian Portuguese, English and Spanish
 * (docs/DECISIONS.md, decision 3): chosen from the device's languages, with
 * Brazilian Portuguese when the device asks for none of the three.
 *
 * Microcopy follows docs/ANGULO.md §7: a button names its action and object,
 * an error says what happened and what to do.
 */

/** The interface's languages. */
export type Locale = 'pt-BR' | 'en' | 'es';

/** Every text of the interface. */
export interface Messages {
  readonly lead: string;
  readonly choosePhoto: string;
  readonly chooseAnother: string;
  readonly opening: string;
  readonly privacy: string;
  readonly fixedCorrection: string;
  readonly previewLabel: string;
  readonly opened: (width: number, height: number) => string;
  readonly openedReduced: (
    width: number,
    height: number,
    originalWidth: number,
    originalHeight: number,
  ) => string;
  readonly errorDecode: string;
  readonly errorWebGL: string;
  readonly errorDraw: string;
}

/** "960 × 1280". */
function size(width: number, height: number): string {
  return `${width} × ${height}`;
}

/** The texts of each language. */
export const MESSAGES: Readonly<Record<Locale, Messages>> = {
  'pt-BR': {
    lead: 'Corrige a geometria de fotos feitas com lente grande angular: as verticais que convergem e as bordas esticadas.',
    choosePhoto: 'Escolher foto',
    chooseAnother: 'Escolher outra foto',
    opening: 'Abrindo a foto…',
    privacy: 'Suas fotos não saem do aparelho.',
    fixedCorrection:
      'Os controles ainda não existem: a prévia aplica a correção fixa do caso de referência (inclinação de 17,5°, rotação de 0,8°, lente de 13 mm).',
    previewLabel: 'Prévia da foto corrigida',
    opened: (w, h) => `Foto aberta: ${size(w, h)} px.`,
    openedReduced: (w, h, ow, oh) =>
      `Foto aberta e reduzida de ${size(ow, oh)} para ${size(w, h)} px, o máximo que o FotoGeometria abre neste aparelho.`,
    errorDecode:
      'Não foi possível abrir este arquivo como imagem. Escolha uma foto em JPEG, PNG ou WebP.',
    errorWebGL:
      'Este navegador não oferece WebGL2, que o FotoGeometria usa para corrigir a foto. Abra a página num navegador atualizado.',
    errorDraw: 'Não foi possível desenhar a prévia. Recarregue a página e escolha a foto de novo.',
  },
  en: {
    lead: 'Fixes the geometry of photos taken with a wide-angle lens: converging verticals and stretched edges.',
    choosePhoto: 'Choose photo',
    chooseAnother: 'Choose another photo',
    opening: 'Opening the photo…',
    privacy: 'Your photos never leave the device.',
    fixedCorrection:
      'There are no controls yet: the preview applies the fixed correction of the reference case (17.5° tilt, 0.8° rotation, 13 mm lens).',
    previewLabel: 'Preview of the corrected photo',
    opened: (w, h) => `Photo opened: ${size(w, h)} px.`,
    openedReduced: (w, h, ow, oh) =>
      `Photo opened and reduced from ${size(ow, oh)} to ${size(w, h)} px, the most FotoGeometria opens on this device.`,
    errorDecode: 'This file could not be opened as an image. Choose a photo in JPEG, PNG or WebP.',
    errorWebGL:
      'This browser does not offer WebGL2, which FotoGeometria uses to correct the photo. Open the page in an up-to-date browser.',
    errorDraw: 'The preview could not be drawn. Reload the page and choose the photo again.',
  },
  es: {
    lead: 'Corrige la geometría de fotos tomadas con lente gran angular: las verticales que convergen y los bordes estirados.',
    choosePhoto: 'Elegir foto',
    chooseAnother: 'Elegir otra foto',
    opening: 'Abriendo la foto…',
    privacy: 'Tus fotos no salen del dispositivo.',
    fixedCorrection:
      'Todavía no hay controles: la vista previa aplica la corrección fija del caso de referencia (inclinación de 17,5°, rotación de 0,8°, lente de 13 mm).',
    previewLabel: 'Vista previa de la foto corregida',
    opened: (w, h) => `Foto abierta: ${size(w, h)} px.`,
    openedReduced: (w, h, ow, oh) =>
      `Foto abierta y reducida de ${size(ow, oh)} a ${size(w, h)} px, lo máximo que FotoGeometria abre en este dispositivo.`,
    errorDecode: 'No se pudo abrir este archivo como imagen. Elige una foto en JPEG, PNG o WebP.',
    errorWebGL:
      'Este navegador no ofrece WebGL2, que FotoGeometria usa para corregir la foto. Abre la página en un navegador actualizado.',
    errorDraw: 'No se pudo dibujar la vista previa. Recarga la página y elige la foto de nuevo.',
  },
};

/**
 * The interface's language for a device that prefers these languages, in
 * order (navigator.languages): the first that is Portuguese, English or
 * Spanish, in any region; Brazilian Portuguese when none is.
 */
export function pickLocale(preferred: readonly string[]): Locale {
  for (const tag of preferred) {
    const language = tag.toLowerCase().split('-')[0];
    if (language === 'pt') return 'pt-BR';
    if (language === 'en') return 'en';
    if (language === 'es') return 'es';
  }
  return 'pt-BR';
}
