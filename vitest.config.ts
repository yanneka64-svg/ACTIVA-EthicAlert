import { defineConfig } from 'vitest/config';

// === AMÉLIORATION AJOUTÉE ===
// Without this, vitest's default test-file discovery also picks up
// functions/lib/**/*.test.js — the compiled output of `npm --prefix
// functions run build` (functions/tsconfig.json includes ../src/domain,
// so the *.test.ts files there get compiled alongside it). Those .js
// files import the CJS-built 'vitest' require(), which throws immediately
// — a false failure with nothing wrong in the actual source. functions/lib
// is gitignored and shouldn't exist in a clean checkout, but any local
// build leaves it there until removed, so this exclusion makes `npm test`
// robust either way rather than relying on remembering to clean it up.
export default defineConfig({
  test: {
    exclude: ['**/node_modules/**', '**/dist/**', 'functions/lib/**', 'functions/node_modules/**'],
  },
});
