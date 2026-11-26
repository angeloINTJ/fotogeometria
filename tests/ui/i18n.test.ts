/**
 * The interface's language (src/ui/i18n.ts, docs/DECISIONS.md decision 3).
 */
import { describe, expect, it } from 'vitest';
import type { Locale } from '../../src/ui/i18n';
import { MESSAGES, formatSlider, pickLocale } from '../../src/ui/i18n';

describe('pickLocale', () => {
  it("speaks the device's language, in any region", () => {
    expect(pickLocale(['pt-BR'])).toBe('pt-BR');
    expect(pickLocale(['pt-PT'])).toBe('pt-BR');
    expect(pickLocale(['en-US'])).toBe('en');
    expect(pickLocale(['EN'])).toBe('en');
    expect(pickLocale(['es-419'])).toBe('es');
  });

  it('takes the first of the three among the languages the device prefers', () => {
    expect(pickLocale(['de-DE', 'es-ES', 'en-US'])).toBe('es');
  });

  it('falls back to Brazilian Portuguese', () => {
    expect(pickLocale(['de-DE', 'fr'])).toBe('pt-BR');
    expect(pickLocale([])).toBe('pt-BR');
  });
});

describe('MESSAGES', () => {
  const locales = Object.keys(MESSAGES) as Locale[];

  it('has the three languages', () => {
    expect(locales.sort()).toEqual(['en', 'es', 'pt-BR']);
  });

  it('has every text in every language, and each one says something', () => {
    /** Every text under a value: a string, what a function says, or a record's texts. */
    const texts = (value: unknown, path: string): Array<[string, string]> => {
      if (typeof value === 'string') return [[path, value]];
      if (typeof value === 'function') {
        return [[path, String((value as (...args: unknown[]) => unknown)(1, 2, 3, 4))]];
      }
      return Object.entries(value as Record<string, unknown>).flatMap(([key, inner]) =>
        texts(inner, `${path}.${key}`),
      );
    };
    const keysOf = (locale: Locale) =>
      texts(MESSAGES[locale], locale).map(([path]) => path.slice(locale.length));
    for (const locale of locales) {
      expect(keysOf(locale)).toEqual(keysOf('pt-BR'));
      for (const [path, said] of texts(MESSAGES[locale], locale)) {
        expect(said, path).toMatch(/\S/);
      }
    }
  });

  it('says the size it opened, and the size it came in when it had to reduce it', () => {
    expect(MESSAGES['pt-BR'].opened(960, 1280)).toBe('Foto aberta: 960 × 1280 px.');
    expect(MESSAGES.en.openedReduced(4096, 3072, 8000, 6000)).toContain(
      'from 8000 × 6000 to 4096 × 3072 px',
    );
  });
});

describe('formatSlider', () => {
  it('writes degrees with their sign and one decimal, in each language', () => {
    expect(formatSlider('pt-BR', 'pitchOffsetDeg', 2.5)).toBe('+2,5°');
    expect(formatSlider('en', 'pitchOffsetDeg', 2.5)).toBe('+2.5°');
    expect(formatSlider('es', 'rollOffsetDeg', -3)).toBe('-3,0°');
    expect(formatSlider('pt-BR', 'rollOffsetDeg', 0)).toBe('0,0°');
  });

  it('writes the edges in percent, and the focal length in millimetres', () => {
    expect(formatSlider('pt-BR', 'paniniD', 0.7)).toBe('70%');
    expect(formatSlider('es', 'verticalCompression', 0.7)).toBe('70\u00a0%');
    expect(formatSlider('pt-BR', 'focal35mm', 12.5)).toBe('12,5 mm');
    expect(formatSlider('en', 'focal35mm', 24)).toBe('24 mm');
  });
});
