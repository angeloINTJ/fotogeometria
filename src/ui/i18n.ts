/**
 * The interface's texts, in Brazilian Portuguese, English and Spanish
 * (docs/DECISIONS.md, decision 3): chosen from the device's languages, with
 * Brazilian Portuguese when the device asks for none of the three.
 *
 * Microcopy follows docs/ANGULO.md §7: a button names its action and object,
 * an error says what happened and what to do.
 */
import type { SliderKey, Tool } from './controls';

/** The interface's languages. */
export type Locale = 'pt-BR' | 'en' | 'es';

/** Every text of the interface. */
export interface Messages {
  readonly lead: string;
  readonly choosePhoto: string;
  readonly takePhoto: string;
  readonly changePhoto: string;
  readonly opening: string;
  readonly privacy: string;
  readonly previewLabel: string;
  readonly originalLabel: string;
  readonly opened: (width: number, height: number) => string;
  readonly openedReduced: (
    width: number,
    height: number,
    originalWidth: number,
    originalHeight: number,
  ) => string;
  readonly undo: string;
  readonly restoreDefaults: string;
  readonly grid: string;
  readonly showOriginal: string;
  readonly showOriginalHint: string;
  readonly toolsLabel: string;
  readonly tools: Readonly<Record<Tool, string>>;
  readonly sliders: Readonly<Record<SliderKey, string>>;
  readonly levelHint: string;
  readonly edgesHint: string;
  readonly lensPresets: string;
  readonly focalFromPhoto: (mm: string) => string;
  readonly focalOutOfRange: (mm: string, min: string, max: string) => string;
  readonly focalNone: string;
  readonly focalUnreadable: string;
  readonly measuring: string;
  readonly measured: (fps: number) => string;
  readonly measureFailed: string;
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
    takePhoto: 'Tirar foto',
    changePhoto: 'Trocar foto',
    opening: 'Abrindo a foto…',
    privacy: 'Suas fotos não saem do aparelho.',
    previewLabel: 'Prévia da foto corrigida',
    originalLabel: 'A foto original',
    opened: (w, h) => `Foto aberta: ${size(w, h)} px.`,
    openedReduced: (w, h, ow, oh) =>
      `Foto aberta e reduzida de ${size(ow, oh)} para ${size(w, h)} px, o máximo que o FotoGeometria abre neste aparelho.`,
    undo: 'Desfazer',
    restoreDefaults: 'Restaurar padrões',
    grid: 'Grade',
    showOriginal: 'Ver original',
    showOriginalHint: 'Segure este botão, ou a prévia, para ver a foto sem correção.',
    toolsLabel: 'Ferramentas',
    tools: { level: 'Nivelar', edges: 'Bordas', lens: 'Lente' },
    sliders: {
      pitchOffsetDeg: 'Inclinação',
      rollOffsetDeg: 'Rotação',
      paniniD: 'Panini',
      verticalCompression: 'Compressão vertical',
      focal35mm: 'Focal equivalente',
    },
    levelHint: 'Ajuste até as verticais da foto ficarem retas. A grade ajuda.',
    edgesHint:
      'A Panini desfaz o esticamento das laterais; a compressão vertical, o do topo e da base.',
    lensPresets: 'Lente do celular',
    focalFromPhoto: (mm) => `A foto informa ${mm}.`,
    focalOutOfRange: (mm, min, max) =>
      `A foto informa ${mm}, fora da faixa do controle, de ${min} a ${max}.`,
    focalNone: 'A foto não informa a focal: escolha a lente com que ela foi feita.',
    focalUnreadable:
      'Não foi possível ler a focal desta foto: escolha a lente com que ela foi feita.',
    measureFailed: 'Não foi possível medir a prévia: deixe a página visível e abra a foto de novo.',
    measuring: 'Medindo a prévia…',
    measured: (fps) => `Prévia a ${fps} quadros por segundo com os controles em movimento.`,
    errorDecode:
      'Não foi possível abrir este arquivo como imagem. Escolha uma foto em JPEG, PNG ou WebP.',
    errorWebGL:
      'Este navegador não oferece WebGL2, que o FotoGeometria usa para corrigir a foto. Abra a página num navegador atualizado.',
    errorDraw: 'Não foi possível desenhar a prévia. Recarregue a página e escolha a foto de novo.',
  },
  en: {
    lead: 'Fixes the geometry of photos taken with a wide-angle lens: converging verticals and stretched edges.',
    choosePhoto: 'Choose photo',
    takePhoto: 'Take photo',
    changePhoto: 'Change photo',
    opening: 'Opening the photo…',
    privacy: 'Your photos never leave the device.',
    previewLabel: 'Preview of the corrected photo',
    originalLabel: 'The original photo',
    opened: (w, h) => `Photo opened: ${size(w, h)} px.`,
    openedReduced: (w, h, ow, oh) =>
      `Photo opened and reduced from ${size(ow, oh)} to ${size(w, h)} px, the most FotoGeometria opens on this device.`,
    undo: 'Undo',
    restoreDefaults: 'Restore defaults',
    grid: 'Grid',
    showOriginal: 'Show original',
    showOriginalHint: 'Hold this button, or the preview, to see the photo uncorrected.',
    toolsLabel: 'Tools',
    tools: { level: 'Level', edges: 'Edges', lens: 'Lens' },
    sliders: {
      pitchOffsetDeg: 'Tilt',
      rollOffsetDeg: 'Rotation',
      paniniD: 'Panini',
      verticalCompression: 'Vertical compression',
      focal35mm: 'Equivalent focal length',
    },
    levelHint: "Adjust until the photo's verticals stand straight. The grid helps.",
    edgesHint:
      'Panini undoes the stretch at the sides; vertical compression, at the top and bottom.',
    lensPresets: 'Phone lens',
    focalFromPhoto: (mm) => `The photo records ${mm}.`,
    focalOutOfRange: (mm, min, max) =>
      `The photo records ${mm}, outside the control's range, ${min} to ${max}.`,
    focalNone: 'The photo does not record its focal length: choose the lens it was taken with.',
    focalUnreadable:
      'The focal length of this photo could not be read: choose the lens it was taken with.',
    measureFailed:
      'The preview could not be measured: keep the page visible and open the photo again.',
    measuring: 'Measuring the preview…',
    measured: (fps) => `Preview at ${fps} frames per second with the controls moving.`,
    errorDecode: 'This file could not be opened as an image. Choose a photo in JPEG, PNG or WebP.',
    errorWebGL:
      'This browser does not offer WebGL2, which FotoGeometria uses to correct the photo. Open the page in an up-to-date browser.',
    errorDraw: 'The preview could not be drawn. Reload the page and choose the photo again.',
  },
  es: {
    lead: 'Corrige la geometría de fotos tomadas con lente gran angular: las verticales que convergen y los bordes estirados.',
    choosePhoto: 'Elegir foto',
    takePhoto: 'Tomar foto',
    changePhoto: 'Cambiar foto',
    opening: 'Abriendo la foto…',
    privacy: 'Tus fotos no salen del dispositivo.',
    previewLabel: 'Vista previa de la foto corregida',
    originalLabel: 'La foto original',
    opened: (w, h) => `Foto abierta: ${size(w, h)} px.`,
    openedReduced: (w, h, ow, oh) =>
      `Foto abierta y reducida de ${size(ow, oh)} a ${size(w, h)} px, lo máximo que FotoGeometria abre en este dispositivo.`,
    undo: 'Deshacer',
    restoreDefaults: 'Restablecer valores',
    grid: 'Cuadrícula',
    showOriginal: 'Ver original',
    showOriginalHint:
      'Mantén pulsado este botón, o la vista previa, para ver la foto sin corregir.',
    toolsLabel: 'Herramientas',
    tools: { level: 'Nivelar', edges: 'Bordes', lens: 'Lente' },
    sliders: {
      pitchOffsetDeg: 'Inclinación',
      rollOffsetDeg: 'Rotación',
      paniniD: 'Panini',
      verticalCompression: 'Compresión vertical',
      focal35mm: 'Focal equivalente',
    },
    levelHint: 'Ajusta hasta que las verticales de la foto queden rectas. La cuadrícula ayuda.',
    edgesHint:
      'Panini deshace el estiramiento de los laterales; la compresión vertical, el de arriba y abajo.',
    lensPresets: 'Lente del teléfono',
    focalFromPhoto: (mm) => `La foto indica ${mm}.`,
    focalOutOfRange: (mm, min, max) =>
      `La foto indica ${mm}, fuera del rango del control, de ${min} a ${max}.`,
    focalNone: 'La foto no indica su focal: elige la lente con la que se tomó.',
    focalUnreadable: 'No se pudo leer la focal de esta foto: elige la lente con la que se tomó.',
    measureFailed:
      'No se pudo medir la vista previa: mantén la página visible y abre la foto de nuevo.',
    measuring: 'Midiendo la vista previa…',
    measured: (fps) =>
      `Vista previa a ${fps} fotogramas por segundo con los controles en movimiento.`,
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

/**
 * The number formats of a language, made once: making an Intl.NumberFormat
 * costs more than using one, and the editor writes values on every frame a
 * slider moves.
 */
const formats = new Map<Locale, Record<'degrees' | 'percent' | 'decimal', Intl.NumberFormat>>();

function formatsOf(locale: Locale): Record<'degrees' | 'percent' | 'decimal', Intl.NumberFormat> {
  let made = formats.get(locale);
  if (!made) {
    made = {
      degrees: new Intl.NumberFormat(locale, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
        signDisplay: 'exceptZero',
      }),
      percent: new Intl.NumberFormat(locale, { style: 'percent' }),
      decimal: new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }),
    };
    formats.set(locale, made);
  }
  return made;
}

/**
 * How a slider's value reads, in the interface's language: degrees with one
 * decimal and their sign, the edges in percent, the focal length in
 * millimetres ("+2,5°", "70%", "24 mm" in Brazilian Portuguese).
 */
export function formatSlider(locale: Locale, key: SliderKey, value: number): string {
  switch (key) {
    case 'pitchOffsetDeg':
    case 'rollOffsetDeg':
      return `${formatsOf(locale).degrees.format(value)}°`;
    case 'paniniD':
    case 'verticalCompression':
      return formatsOf(locale).percent.format(value);
    case 'focal35mm':
      return formatMillimetres(locale, value);
  }
}

/** A length in millimetres, as the interface writes it ("12,5 mm"). */
export function formatMillimetres(locale: Locale, mm: number): string {
  return `${formatsOf(locale).decimal.format(mm)} mm`;
}
