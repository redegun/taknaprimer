// Проверка внутренних ссылок по собранному сайту: каждый href/src в dist/**/*.html должен существовать в dist.
// node scripts/link-check.mjs [--live https://taknaprimer.ru]  — с --live дополнительно HEAD-запросы к живому сайту (уникальные пути)
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const DIST = path.join(ROOT, 'dist');
const liveIdx = process.argv.indexOf('--live');
const LIVE = liveIdx > -1 ? process.argv[liveIdx + 1].replace(/\/$/, '') : null;
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.html') ? [path.join(d, e.name)] : []));
const pages = walk(DIST);
const refs = new Map(); // url -> [pages]
for (const f of pages) {
  const html = fs.readFileSync(f, 'utf8');
  const page = '/' + path.relative(DIST, f).replace(/\\/g, '/');
  for (const m of html.matchAll(/\b(?:href|src|poster)="([^"#?]+)[^"]*"/g)) {
    const url = m[1];
    if (/^(https?:|mailto:|tel:|data:|\/\/)/.test(url)) continue;
    const abs = url.startsWith('/') ? url : path.posix.join(path.posix.dirname(page), url);
    if (!refs.has(abs)) refs.set(abs, []);
    refs.get(abs).push(page);
  }
}
const exists = (u) => {
  const p = path.join(DIST, decodeURIComponent(u));
  if (fs.existsSync(p)) return fs.statSync(p).isDirectory() ? fs.existsSync(path.join(p, 'index.html')) : true;
  return false;
};
const missing = [...refs].filter(([u]) => !exists(u) && !u.startsWith('/lenta-media/'));
console.log(`страниц ${pages.length}, уникальных внутренних ссылок ${refs.size}, битых в dist: ${missing.length}`);
for (const [u, ps] of missing.slice(0, 30)) console.log('  ', u, '←', ps.slice(0, 3).join(' '), ps.length > 3 ? `(+${ps.length - 3})` : '');
if (LIVE) {
  const urls = [...refs.keys()].filter((u) => !u.startsWith('/lenta-media/') && !u.startsWith('/cases/') && !u.startsWith('/decor/') && !u.startsWith('/assets/'));
  let bad = 0;
  for (const u of urls) {
    const r = await fetch(LIVE + u, { method: 'HEAD', redirect: 'manual' }).catch(() => null);
    const code = r ? r.status : 0;
    if (code !== 200 && code !== 405) { bad++; console.log('  LIVE', code, u); }
  }
  console.log(`live: проверено ${urls.length} путей, не 200: ${bad}`);
}
