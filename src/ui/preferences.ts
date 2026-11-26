/**
 * What the app keeps between visits (PLANO.md §4: the controls' last values,
 * in localStorage, with try/catch): the look of the edges, and whether the
 * grid is on. Per-photo settings, the levelling and the focal length, are
 * not kept: they belong to one photo.
 *
 * Storage can be missing, full or forbidden (a private window, a blocked
 * site): reading then gives nothing and writing reports false, and the app
 * goes on with its defaults.
 */
import type { Remembered } from './controls';
import { SLIDERS } from './controls';

/** The localStorage key. */
export const PREFERENCES_KEY = 'fotogeometria:preferencias';

/** Everything kept. */
export interface Preferences extends Remembered {
  readonly grid?: boolean;
}

/** The part of Storage the app uses, so tests can pass their own. */
export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

/** localStorage, or null where touching it throws (some private modes do). */
export function browserStorage(): StorageLike | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** A kept number, when it is one the slider can hold. */
function sliderValue(key: 'paniniD' | 'verticalCompression', value: unknown): number | undefined {
  const { min, max } = SLIDERS[key];
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
    ? value
    : undefined;
}

/**
 * The kept preferences. Anything unreadable, or out of range, is left out:
 * a value written by another version of the app must not break this one.
 */
export function loadPreferences(storage: StorageLike | null): Preferences {
  let raw: unknown;
  try {
    raw = JSON.parse(storage?.getItem(PREFERENCES_KEY) ?? 'null');
  } catch {
    return {};
  }
  if (raw === null || typeof raw !== 'object') return {};
  const kept = raw as Record<string, unknown>;
  const preferences: { -readonly [K in keyof Preferences]: Preferences[K] } = {};
  const paniniD = sliderValue('paniniD', kept.paniniD);
  const verticalCompression = sliderValue('verticalCompression', kept.verticalCompression);
  if (paniniD !== undefined) preferences.paniniD = paniniD;
  if (verticalCompression !== undefined) preferences.verticalCompression = verticalCompression;
  if (typeof kept.grid === 'boolean') preferences.grid = kept.grid;
  return preferences;
}

/** Keeps the preferences; false when the storage refused them. */
export function savePreferences(storage: StorageLike | null, preferences: Preferences): boolean {
  if (!storage) return false;
  try {
    storage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
    return true;
  } catch {
    return false;
  }
}
