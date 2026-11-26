/**
 * The editor's controls as data (src/ui/controls.ts), the undo history
 * (src/ui/history.ts) and what is kept between visits (src/ui/preferences.ts).
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_FOCAL_35MM, FOCAL_35MM_RANGE, LENS_PRESETS } from '../../src/core/camera';
import { DEFAULT_PARAMS, buildProjection } from '../../src/core/correction';
import type { SliderKey } from '../../src/ui/controls';
import {
  SLIDERS,
  TOOLS,
  clampToSlider,
  defaultParams,
  initialParams,
  presetOf,
  withSlider,
} from '../../src/ui/controls';
import { HISTORY_LIMIT, remember, sameParams, undo } from '../../src/ui/history';
import { MEASURE_SECONDS, measuredParams } from '../../src/ui/app';
import type { StorageLike } from '../../src/ui/preferences';
import { PREFERENCES_KEY, loadPreferences, savePreferences } from '../../src/ui/preferences';

const KEYS = Object.keys(SLIDERS) as SliderKey[];

describe('the sliders', () => {
  it('start every photo inside their range', () => {
    for (const key of KEYS) {
      const value = DEFAULT_PARAMS[key];
      expect(value, key).toBeGreaterThanOrEqual(SLIDERS[key].min);
      expect(value, key).toBeLessThanOrEqual(SLIDERS[key].max);
    }
  });

  it("give the focal length the plan's range, 10 to 60 mm (§4)", () => {
    expect([SLIDERS.focal35mm.min, SLIDERS.focal35mm.max]).toEqual([
      FOCAL_35MM_RANGE.min,
      FOCAL_35MM_RANGE.max,
    ]);
  });

  it('each belong to one tool', () => {
    const placed = TOOLS.flatMap((t) => t.sliders);
    expect([...placed].sort()).toEqual([...KEYS].sort());
  });

  it('hold a value to the range and the step', () => {
    expect(clampToSlider('pitchOffsetDeg', 40)).toBe(25);
    expect(clampToSlider('pitchOffsetDeg', -40)).toBe(-25);
    expect(clampToSlider('pitchOffsetDeg', 2.54)).toBe(2.5);
    expect(clampToSlider('paniniD', 0.333)).toBe(0.33);
    expect(clampToSlider('focal35mm', 26.2)).toBe(26);
    expect(clampToSlider('focal35mm', 120)).toBe(60);
  });

  it('change one parameter and leave the others', () => {
    const changed = withSlider(DEFAULT_PARAMS, 'rollOffsetDeg', 1.25);
    expect(changed.rollOffsetDeg).toBe(1.3);
    expect({ ...changed, rollOffsetDeg: 0 }).toEqual(DEFAULT_PARAMS);
  });

  it('keep the framing finite across the pitch range, at the widest focal length', () => {
    // docs/DECISIONS.md. Measured on 2026-11-26: at ±25° and 10 mm, 1.6
    // (3:4) and 1.9 (9:16) times the photo's area; at ±30°, a 9:16 photo's
    // far edge reaches the horizon and frames it at 235 times.
    for (const [width, height] of [
      [3024, 4032],
      [2250, 4000],
    ]) {
      for (const pitch of [SLIDERS.pitchOffsetDeg.min, SLIDERS.pitchOffsetDeg.max]) {
        const { framing } = buildProjection(
          { ...DEFAULT_PARAMS, focal35mm: FOCAL_35MM_RANGE.min, pitchOffsetDeg: pitch },
          width,
          height,
        );
        expect(framing.width * framing.height).toBeLessThan(width * height * 4);
      }
    }
  });
});

describe('presetOf', () => {
  it('names the lens preset a focal length is', () => {
    expect(presetOf(LENS_PRESETS['0.5x'])).toBe('0.5x');
    expect(presetOf(LENS_PRESETS['2x'])).toBe('2x');
    expect(presetOf(26)).toBeNull();
  });
});

describe('initialParams and defaultParams', () => {
  it('open a photo with the defaults, unlevelled, at 13 mm when it says nothing', () => {
    const params = initialParams({}, null);
    expect(params).toEqual({ ...DEFAULT_PARAMS, focal35mm: DEFAULT_FOCAL_35MM });
    expect(params.vanishingPoint).toBeNull();
  });

  it("take the photo's own focal length, held to the slider", () => {
    expect(initialParams({}, 26).focal35mm).toBe(26);
    expect(initialParams({}, 77).focal35mm).toBe(60);
    expect(initialParams({}, 8).focal35mm).toBe(10);
  });

  it('keep the edges as they were last left', () => {
    const params = initialParams({ paniniD: 0.3, verticalCompression: 0.1 }, null);
    expect([params.paniniD, params.verticalCompression]).toEqual([0.3, 0.1]);
  });

  it("restore every default but the photo's own focal length", () => {
    expect(defaultParams(26)).toEqual({ ...DEFAULT_PARAMS, focal35mm: 26 });
    expect(defaultParams(null)).toEqual(DEFAULT_PARAMS);
  });
});

describe('the history', () => {
  const a = DEFAULT_PARAMS;
  const b = withSlider(a, 'paniniD', 0.2);
  const c = withSlider(b, 'pitchOffsetDeg', 3);

  it('undoes changes newest first, back to the start', () => {
    let history = remember(remember([], a, b), b, c);
    const first = undo(history)!;
    expect(first.params).toEqual(b);
    history = first.history;
    const second = undo(history)!;
    expect(second.params).toEqual(a);
    expect(undo(second.history)).toBeNull();
  });

  it('does not keep a change that changed nothing', () => {
    expect(remember([], a, { ...a })).toEqual([]);
  });

  it(`forgets past ${HISTORY_LIMIT} changes, the oldest first`, () => {
    // The oldest change starts from b, which no later change does.
    let history = remember([], b, c);
    for (let i = 1; i <= HISTORY_LIMIT; i++) {
      history = remember(history, withSlider(a, 'rollOffsetDeg', i / 10), c);
    }
    expect(history).toHaveLength(HISTORY_LIMIT);
    expect(history.some((params) => sameParams(params, b))).toBe(false);
    expect(history[0].rollOffsetDeg).toBe(0.1);
  });
});

/** A storage in memory, or one that refuses like a blocked site. */
function memory(
  initial: Record<string, string> = {},
  refuses = false,
): StorageLike & {
  items: Record<string, string>;
} {
  const items = { ...initial };
  return {
    items,
    getItem: (key) => {
      if (refuses) throw new DOMException('denied', 'SecurityError');
      return items[key] ?? null;
    },
    setItem: (key, value) => {
      if (refuses) throw new DOMException('full', 'QuotaExceededError');
      items[key] = value;
    },
  };
}

describe('the preferences', () => {
  it('come back as they were kept', () => {
    const storage = memory();
    expect(savePreferences(storage, { paniniD: 0.4, verticalCompression: 0.2, grid: true })).toBe(
      true,
    );
    expect(loadPreferences(storage)).toEqual({
      paniniD: 0.4,
      verticalCompression: 0.2,
      grid: true,
    });
  });

  it('leave out what they cannot read, or what the sliders cannot hold', () => {
    expect(loadPreferences(memory({ [PREFERENCES_KEY]: '{not json' }))).toEqual({});
    expect(
      loadPreferences(
        memory({ [PREFERENCES_KEY]: '{"paniniD": 7, "grid": "yes", "focal35mm": 24}' }),
      ),
    ).toEqual({});
    expect(loadPreferences(memory({ [PREFERENCES_KEY]: '[0.4]' }))).toEqual({});
  });

  it('go on without a storage, or with one that refuses', () => {
    expect(loadPreferences(null)).toEqual({});
    expect(loadPreferences(memory({}, true))).toEqual({});
    expect(savePreferences(null, { grid: true })).toBe(false);
    expect(savePreferences(memory({}, true), { grid: true })).toBe(false);
  });
});

describe('measuredParams (?medir)', () => {
  it('gives every frame a new correction, within the sliders', () => {
    const frames = Array.from({ length: 60 * MEASURE_SECONDS }, (_, n) =>
      measuredParams(DEFAULT_PARAMS, n),
    );
    for (let n = 1; n < frames.length; n++) {
      expect(sameParams(frames[n], frames[n - 1]), `frame ${n}`).toBe(false);
    }
    for (const params of frames) {
      for (const key of ['paniniD', 'pitchOffsetDeg'] as const) {
        expect(params[key]).toBeGreaterThanOrEqual(SLIDERS[key].min);
        expect(params[key]).toBeLessThanOrEqual(SLIDERS[key].max);
      }
    }
  });
});
