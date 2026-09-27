import { defineConfig } from 'vite';

// Relative base so the build runs from any subfolder: itch.io, GitHub Pages, or a local file server.
export default defineConfig({
  base: './',
  build: { outDir: 'dist', assetsInlineLimit: 0, chunkSizeWarningLimit: 900 },
});
