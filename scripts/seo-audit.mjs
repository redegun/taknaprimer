// Аудит собранного сайта: title / description / h1 / canonical по всем dist/**/index.html.
// node scripts/seo-audit.mjs [--verbose]
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const DIST = path.join(ROOT, 'dist');
const verbose = process.argv.includes('--verbose');
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : e.name === 'index.html' || e.name === '404.html' ? [path.join(d, e.name)] : []));
const dec = (s) => s.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const pages = walk(DIST).map((f) => {
  const html = fs.readFileSync(f, 'utf8');
  const url = '/' + path.relative(DIST, f).replace(/\\/g, '/').replace(/index\.html$/, '');
  const title = dec((html.match(/<title>([^<]*)<\/title>/) || [, ''])[1]);
  const desc = dec((html.match(/<meta name="description" content="([^"]*)"/) || [, ''])[1]);
  const h1 = (html.match(/<h1[\s>]/g) || []).length;
  const noindex = /name="robots" content="noindex/.test(html);
  const canonical = (html.match(/<link rel="canonical" href="([^"]*)"/) || [, ''])[1];
  const redirect = /http-equiv="refresh"/i.test(html);
  return { url, title, desc, h1, noindex, canonical, redirect };
});
const brand = (s) => /так, например/i.test(s) && /taknaprimer/i.test(s);
const issues = [];
const seenT = new Map(), seenD = new Map();
const redirects = pages.filter((p) => p.redirect).length;
for (const p of pages) {
  if (p.noindex) continue; // редиректы слитых постов и 404 — не для поиска
  if (!p.title) issues.push([p.url, 'нет title']);
  if (!p.desc) issues.push([p.url, 'нет description']);
  if (p.title && !brand(p.title)) issues.push([p.url, 'в title нет бренда кириллицей+латиницей']);
  if (p.desc && !brand(p.desc)) issues.push([p.url, 'в description нет бренда']);
  if (p.title.length > 90) issues.push([p.url, `title длинный: ${p.title.length}`]);
  if (p.desc.length > 300) issues.push([p.url, `description длинный: ${p.desc.length}`]);
  if (p.desc && p.desc.length < 60) issues.push([p.url, `description короткий: ${p.desc.length}`]);
  if (p.h1 !== 1) issues.push([p.url, `h1: ${p.h1}`]);
  if (!p.noindex && !p.url.includes('404')) {
    seenT.set(p.title, [...(seenT.get(p.title) || []), p.url]);
    seenD.set(p.desc, [...(seenD.get(p.desc) || []), p.url]);
  }
}
for (const [t, urls] of seenT) if (urls.length > 1) issues.push([urls.join(' '), `дубль title: ${t.slice(0, 60)}`]);
for (const [d, urls] of seenD) if (urls.length > 1) issues.push([urls.slice(0, 5).join(' '), `дубль description (${urls.length} стр.)`]);
const lens = (arr) => `мин ${Math.min(...arr)} / медиана ${arr.sort((a, b) => a - b)[Math.floor(arr.length / 2)]} / макс ${Math.max(...arr)}`;
console.log(`страниц: ${pages.length}, noindex: ${pages.filter((p) => p.noindex).length} (из них редиректов: ${redirects})`);
console.log(`title: ${lens(pages.map((p) => p.title.length))} знаков; description: ${lens(pages.map((p) => p.desc.length))} знаков`);
console.log(`проблем: ${issues.length}`);
for (const [u, m] of issues.slice(0, 40)) console.log('  ', m, '→', u);
if (verbose) for (const p of pages.slice(0, 12)) console.log(`\n${p.url}\n  T: ${p.title}\n  D: ${p.desc}`);
