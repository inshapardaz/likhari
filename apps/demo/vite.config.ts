import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // GitHub Pages serves this repo's Pages site at /likhari/ (a project page,
  // not a user/org page), so built asset URLs need that prefix. Dev stays at
  // the root so `npm run dev` doesn't need it. PR preview builds set
  // VITE_BASE to their own subfolder (see .github/workflows/pr-preview.yml).
  base: command === 'build' ? process.env.VITE_BASE || '/likhari/' : '/',
  server: {
    port: Number(process.env.PORT) || 6175,
    strictPort: true,
  },
}));
