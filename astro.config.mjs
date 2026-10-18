import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync } from 'node:fs';

// SITE_BASE=/_preview — сборка превью в подпапку на Timeweb; по умолчанию корень.
const base = process.env.SITE_BASE || '/';

// Посты, слитые в серии: старый адрес → страница серии (пишет scripts/build-lenta.mjs и крон на VPS)
let merges = {};
try { merges = JSON.parse(readFileSync(new URL('./src/data/lenta-merges.json', import.meta.url), 'utf8')); } catch {}
const redirects = Object.fromEntries(Object.entries(merges).map(([from, to]) => [`/lenta/${from}/`, `/lenta/${to}/`]));

export default defineConfig({
  site: 'https://taknaprimer.ru',
  base,
  trailingSlash: 'always',
  build: { format: 'directory', assets: 'assets' },
  compressHTML: true,
  redirects,
  integrations: [react(), sitemap({ filter: (page) => !Object.keys(redirects).some((r) => page.endsWith(r)) })],
  vite: { plugins: [tailwindcss()] },
});
