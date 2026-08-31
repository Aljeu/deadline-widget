import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' so the production build works from file:// inside Electron.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 5199, strictPort: true },
  build: { outDir: 'dist', emptyOutDir: true },
});
