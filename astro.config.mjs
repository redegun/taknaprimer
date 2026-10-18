import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// SITE_BASE=/_preview — сборка превью в подпапку на Timeweb; по умолчанию корень.
const base = process.env.SITE_BASE || '/';

export default defineConfig({
  site: 'https://taknaprimer.ru',
  base,
  trailingSlash: 'always',
  build: { format: 'directory', assets: 'assets' },
  compressHTML: true,
  integrations: [react(), sitemap()],
  vite: { plugins: [tailwindcss()] },
});
