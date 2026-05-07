import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.astro/**',
      'apps/web/dist/**',
      'agent-tools/**',
      '.cursor/**',
      '**/*.mjs',
      'supabase/**',
      'documentation_files/migrations/**'
    ]
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['apps/api/src/**/*.ts', 'packages/*/src/**/*.ts', 'packages/db/*.ts', 'vitest.config.ts', 'eslint.config.js'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly'
      }
    }
  }
);
