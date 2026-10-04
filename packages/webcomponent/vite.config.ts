import { defineConfig } from 'vite';

// One self-contained module: React, the editor, Mantine and the editor styles
// are bundled in, so a page needs only a <script type="module"> tag.
export default defineConfig({
  // Dependencies read process.env.NODE_ENV; a browser bundle needs it replaced at build time.
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: () => 'likhari-webcomponent.js',
    },
    outDir: 'dist',
    emptyOutDir: true,
  },
});
