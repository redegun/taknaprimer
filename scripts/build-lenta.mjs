// Лента из Telegram: последние посты с фото (без личного и репостов) → src/data/lenta.json + public/lenta-media/<id>/n.webp
// node scripts/build-lenta.mjs --dump <all.json> --media <media.json> [--limit 30]
// Позже то же самое делает крон на VPS по свежему дампу (схема academylu).
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), []));
const DUMP = args.dump, MEDIA = args.media, LIMIT = Number(args.limit || 30);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/cases.json'), 'utf8'));
const dump = JSON.parse(fs.readFileSync(DUMP, 'utf8'));
const media = JSON.parse(fs.readFileSync(MEDIA, 'utf8'));
const hide = new Set(cfg.hide);
const stop = cfg.stop.map((s) => s.toLowerCase());
const cleanText = (t) => (t || '').replace(/#[\wа-яёА-ЯЁ_]+/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

const picked = dump.posts
  .filter((p) => !hide.has(p.id) && media[p.id]?.photos?.length && !stop.some((s) => (p.text || '').toLowerCase().includes(s)))
  .sort((a, b) => b.id - a.id)
  .slice(0, LIMIT);

const out = [];
for (const p of picked) {
  const dir = path.join(ROOT, 'public/lenta-media', String(p.id));
  const photos = [];
  const urls = media[p.id].photos.slice(0, 4);
  for (let i = 0; i < urls.length; i++) {
    const file = path.join(dir, `${i + 1}.webp`);
    if (!fs.existsSync(file)) {
      try {
        const r = await fetch(urls[i], { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!r.ok) throw new Error(String(r.status));
        fs.mkdirSync(dir, { recursive: true });
        await sharp(Buffer.from(await r.arrayBuffer())).rotate().resize({ width: 900, height: 900, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toFile(file);
      } catch (e) { console.warn('skip', p.id, i, e.message); continue; }
    }
    photos.push(`/lenta-media/${p.id}/${i + 1}.webp`);
  }
  if (!photos.length) continue;
  out.push({ id: p.id, date: p.date, text: cleanText(p.text).slice(0, 400), photos, tg: `https://t.me/tak_naprimer/${p.id}` });
}
fs.mkdirSync(path.join(ROOT, 'src/data'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'src/data/lenta.json'), JSON.stringify(out, null, 1));
// копия для клиентского обновления; на хостинге этот файл перезаписывает крон на VPS
fs.mkdirSync(path.join(ROOT, 'public/lenta'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'public/lenta/feed.json'), JSON.stringify(out));
console.log('lenta posts:', out.length);
