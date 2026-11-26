/**
 * The editor's controls as data (PLANO.md §4): which parameter each slider
 * moves, its range and step, the tool it belongs to, and the parameters a
 * photo opens with. Pure: the screen (src/ui/app.ts) draws what is here.
 */
import { DEFAULT_FOCAL_35MM, FOCAL_35MM_RANGE, LENS_PRESETS } from '../core/camera';
import type { CorrectionParams } from '../core/correction';
import { DEFAULT_PARAMS } from '../core/correction';

/** The parameters a slider moves. */
export type SliderKey =
  'pitchOffsetDeg' | 'rollOffsetDeg' | 'paniniD' | 'verticalCompression' | 'focal35mm';

/** A slider: its range and the step its value moves by. */
export interface SliderSpec {
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

/**
 * Every slider. The plan gives the ranges of Panini, compression and focal
 * (§4); the fine adjustment's are docs/DECISIONS.md's: past ±25° of pitch,
 * at the widest focal lengths, the photo's far edge reaches the horizon and
 * the framing grows without bound.
 */
export const SLIDERS: Readonly<Record<SliderKey, SliderSpec>> = {
  pitchOffsetDeg: { min: -25, max: 25, step: 0.1 },
  rollOffsetDeg: { min: -15, max: 15, step: 0.1 },
  paniniD: { min: 0, max: 1, step: 0.01 },
  verticalCompression: { min: 0, max: 1, step: 0.01 },
  focal35mm: { min: FOCAL_35MM_RANGE.min, max: FOCAL_35MM_RANGE.max, step: 0.5 },
};

/** The tools of the toolbar, one shown at a time (PLANO.md §4). */
export type Tool = 'level' | 'edges' | 'lens';

/** The tools, in the toolbar's order, and the sliders of each. */
export const TOOLS: ReadonlyArray<{ readonly tool: Tool; readonly sliders: readonly SliderKey[] }> =
  [
    { tool: 'level', sliders: ['pitchOffsetDeg', 'rollOffsetDeg'] },
    { tool: 'edges', sliders: ['paniniD', 'verticalCompression'] },
    { tool: 'lens', sliders: ['focal35mm'] },
  ];

/** A value a slider can hold: within its range, on its step. */
export function clampToSlider(key: SliderKey, value: number): number {
  const { min, max, step } = SLIDERS[key];
  const stepped = min + Math.round((value - min) / step) * step;
  // Rounded to the step's decimals, so 0.1 steps give 2.5, not 2.5000000000000004.
  const decimals = Math.max(0, -Math.floor(Math.log10(step)));
  return Math.min(max, Math.max(min, Number(stepped.toFixed(decimals))));
}

/** The parameters with one slider's value changed, held to the slider. */
export function withSlider(
  params: CorrectionParams,
  key: SliderKey,
  value: number,
): CorrectionParams {
  return { ...params, [key]: clampToSlider(key, value) };
}

/** The lens preset a focal length is, if it is one. */
export function presetOf(focal35mm: number): keyof typeof LENS_PRESETS | null {
  for (const [name, mm] of Object.entries(LENS_PRESETS)) {
    if (mm === focal35mm) return name as keyof typeof LENS_PRESETS;
  }
  return null;
}

/** What the editor remembers between photos: the edges' look (preferences.ts). */
export interface Remembered {
  readonly paniniD?: number;
  readonly verticalCompression?: number;
}

/**
 * The parameters a photo opens with: the defaults of PLANO.md §3.8, the
 * edges as they were last left, and the photo's own focal length when its
 * EXIF records one (held to the slider's 10 to 60 mm), else 13 mm. The photo
 * opens unlevelled: the vanishing point is traced in stage 4 and detected in
 * stage 6; until then the fine adjustment levels it.
 */
export function initialParams(remembered: Remembered, exifFocal: number | null): CorrectionParams {
  return {
    ...DEFAULT_PARAMS,
    paniniD: remembered.paniniD ?? DEFAULT_PARAMS.paniniD,
    verticalCompression: remembered.verticalCompression ?? DEFAULT_PARAMS.verticalCompression,
    focal35mm: exifFocal === null ? DEFAULT_FOCAL_35MM : clampToSlider('focal35mm', exifFocal),
  };
}

/**
 * "Restaurar padrões" (PLANO.md §4): every control back to its default, but
 * the focal length stays the photo's own when its EXIF records one: that is
 * a fact about the photo, not a setting.
 */
export function defaultParams(exifFocal: number | null): CorrectionParams {
  return initialParams({}, exifFocal);
}
