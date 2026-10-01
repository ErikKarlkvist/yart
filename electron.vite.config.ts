import { resolve } from 'node:path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

const alias = { '@': resolve(__dirname, 'src') };

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias },
    build: {
      rollupOptions: { input: { index: resolve(__dirname, 'src/application/main/index.ts') } },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias },
    build: {
      rollupOptions: { input: { index: resolve(__dirname, 'src/application/preload/index.ts') } },
    },
  },
  renderer: {
    root: resolve(__dirname, 'src/application/renderer'),
    plugins: [react()],
    resolve: { alias },
    define: { __YART_ROOT__: JSON.stringify(__dirname) },
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/application/renderer/index.html') },
      },
    },
  },
});
