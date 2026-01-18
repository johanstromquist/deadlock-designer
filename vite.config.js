import { defineConfig } from 'vite';

export default defineConfig({
  base: '/deadlock-designer/',
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist'
  },
  server: {
    port: 3000,
    open: true
  }
});
