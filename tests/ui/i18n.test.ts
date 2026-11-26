/**
 * The interface's language (src/ui/i18n.ts, docs/DECISIONS.md decision 3).
 */
import { describe, expect, it } from 'vitest';
import type { Locale } from '../../src/ui/i18n';
import { MESSAGES, pickLocale } from '../../src/ui/i18n';

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
    for (const locale of locales) {
      const texts = Object.entries(MESSAGES[locale]) as Array<
        [string, string | ((...sizes: number[]) => string)]
      >;
      for (const [key, text] of texts) {
        const said = typeof text === 'function' ? text(1, 2, 3, 4) : text;
        expect(said, `${locale}.${key}`).toMatch(/\S/);
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
