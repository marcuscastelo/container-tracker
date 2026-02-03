import { defineConfig } from 'vite';

// Ensure esbuild target is modern enough to allow top-level await used by Nitro/Nitropack
export default defineConfig({
  build: {
    target: 'es2022',
  },
});
