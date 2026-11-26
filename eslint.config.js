// ESLint flat config.
//
// Type-aware rules run on the TypeScript sources; plain JavaScript (the tools
// and this file) gets the recommended set without type information. Prettier
// owns formatting, so eslint-config-prettier switches off every stylistic rule
// that would fight it.
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  {
    ignores: [
      'dist/',
      'dev-dist/',
      'coverage/',
      'playwright-report/',
      'test-results/',
      'reference/',
      'node_modules/',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.ts'],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.browser },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'always'],
    },
  },
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // Classic scripts served as they are, in the browser.
    files: ['public/**/*.js'],
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    // The architecture rule of PLANO.md §5: src/core is pure mathematics. It
    // imports nothing from the layers that touch the browser, so the same
    // functions run in the shader's setup, in the crop and in Node tests.
    // tsconfig.core.json holds the other half: core compiles without the DOM.
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/gl/**', '**/ui/**', '**/io/**', '**/detect/**'],
              message: 'src/core is pure math: it must not import from gl/, ui/, io/ or detect/.',
            },
          ],
        },
      ],
    },
  },
  prettier,
);
