import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // GitHub Pages serves this repo's Pages site at /likhari/ (a project page,
  // not a user/org page), so built asset URLs need that prefix. Dev stays at
  // the root so `npm run dev` doesn't need it.
  base: command === 'build' ? '/likhari/' : '/',
  server: {
    port: Number(process.env.PORT) || 5174,
    strictPort: true,
  },
}));
