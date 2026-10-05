import { defineConfig } from 'vite';

// Vue is a peer dependency and the Web Component a dependency: both stay external, so
// the Web Component loads from its own folder with its dictionaries beside it.
export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: () => 'likhari-vue.js',
    },
    rollupOptions: {
      external: ['vue', '@inshapardaz/likhari-webcomponent'],
    },
    outDir: 'dist',
    emptyOutDir: true,
  },
});
