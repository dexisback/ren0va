import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

export default defineConfig({
  outDir: './dist-astro',
  build: {
    format: 'directory',
  },
  integrations: [react()],
});
