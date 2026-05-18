import { defineConfig } from 'astro/config';

export default defineConfig({
  outDir: './dist-astro',
  build: {
    format: 'directory',
  },
});
