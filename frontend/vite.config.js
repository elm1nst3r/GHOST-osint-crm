// File: frontend/vite.config.js
//
// Vite 8 (Rolldown) build, dev server and Vitest config. Replaces Create
// React App (react-scripts), which is deprecated.
//
// - Output goes to build/ so the Dockerfile and nginx config stay as they were.
// - The dev server runs on :3000 and proxies /api and /public to the backend
//   on :3001, like CRA's "proxy" setting did.
// - No script is inlined into index.html, so nginx can send a strict
//   Content-Security-Policy (script-src 'self').
// - React Compiler runs on every build, dev server and test.
// - Tailwind 4 through its Vite plugin; its configuration is in src/index.css.
// - Tests: `npm test` runs the unit tests (jsdom); `npm run test:browser`
//   runs component tests in a real Chromium through Playwright.
import { defineConfig } from 'vite';
import babel from '@rolldown/plugin-babel';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { playwright } from '@vitest/browser-playwright';
import pkg from './package.json' with { type: 'json' };

const backend = process.env.GHOST_BACKEND_URL || 'http://localhost:3001';

export default defineConfig({
  // React Compiler 1.0: memoizes components and hooks at build time, so
  // manual useMemo/useCallback are no longer needed for performance.
  plugins: [react(), babel({ presets: [reactCompilerPreset()] }), tailwindcss()],
  // The version shown in Settings → General, from package.json at build time.
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  server: {
    port: 3000,
    proxy: {
      '/api': backend,
      '/public': backend,
    },
  },
  build: {
    outDir: 'build',
    sourcemap: true,
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'jsdom',
          globals: true,
          include: ['src/**/*.test.{js,jsx}'],
          exclude: ['src/**/*.browser.test.{js,jsx}'],
        },
      },
      {
        extends: true,
        test: {
          name: 'browser',
          globals: true,
          include: ['src/**/*.browser.test.{js,jsx}'],
          // Pre-bundled before the first test. Discovered mid-run instead,
          // Vite reloads and the run fails on a cold cache (as in CI).
          optimizeDeps: {
            include: [
              'react', 'react-dom/client', 'react/jsx-dev-runtime', 'react/compiler-runtime', 'vitest-browser-react',
              'i18next', 'react-i18next', 'lucide-react', '@simplewebauthn/browser',
              'docx', 'file-saver', 'mammoth/mammoth.browser', 'marked', 'dompurify', 'react-window',
              'react-router', 'leaflet', 'react-leaflet', 'react-leaflet-cluster', '@xyflow/react', 'd3', 'papaparse',
            ],
          },
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});
