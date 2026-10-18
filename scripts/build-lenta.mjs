// Лента из Telegram: каждый подходящий пост → src/content/lenta/post-<id>.md (страница /lenta/<id>/)
// + медиа в public/lenta-media/<id>/ (фото n.webp ≤ 1000 px, видео v<n>.mp4 ≤ 14 МБ + v<n>-poster.webp).
// node scripts/build-lenta.mjs --dump <all.json> --media <media.json> [--since <id>]
// public/lenta-media НЕ в git: заливается на хостинг напрямую (локальный деплой / крон на VPS). Новые посты дописывает
// крон scripts/taknaprimer-lenta.py на VPS в том же формате.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { execFileSync } from 'node:child_process';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), []));
const DUMP = args.dump, MEDIA = args.media, SINCE = Number(args.since || 0);
if (!DUMP || !MEDIA) { console.error('usage: --dump all.json --media media.json [--since id]'); process.exit(1); }
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/cases.json'), 'utf8'));
const dump = JSON.parse(fs.readFileSync(DUMP, 'utf8'));
const media = JSON.parse(fs.readFileSync(MEDIA, 'utf8'));
const hide = new Set(cfg.hide);
const stop = cfg.stop.map((s) => s.toLowerCase());
const MAX_VIDEO = 14 * 1024 * 1024;
const OUT = path.join(ROOT, 'src/content/lenta');
const MEDIA_DIR = path.join(ROOT, 'public/lenta-media');
fs.mkdirSync(OUT, { recursive: true });

// пост → кейс (первое совпадение); явно перечисленные id кейса — доверенные (стоп-слова не применяем)
const expand = (list) => list.flatMap((v) => (typeof v === 'number' ? [v] : (([a, b]) => Array.from({ length: b - a + 1 }, (_, i) => a + i))(v.split('-').map(Number))));
const caseOf = new Map(), trusted = new Set();
for (const c of cfg.cases) {
  for (const id of expand(c.posts || [])) if (!caseOf.has(id)) caseOf.set(id, c.slug);
  for (const v of c.posts || []) if (typeof v === 'number') trusted.add(v);
}

const cleanText = (t) => (t || '').replace(/#[\wа-яёА-ЯЁ_]+/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim();
const isPersonal = (t) => { const l = (t || '').toLowerCase(); return stop.some((s) => l.includes(s)); };
const titleOf = (text) => {
  // счётчик челленджа «02/33» / «3/31» — не заголовок: срезаем, а если строка из него одна — берём следующую
  const lines = text.split('\n').map((s) => s.replace(/^\s*\d{1,2}\/\d{2}\s*[-—–]*\s*/, '').trim()).filter(Boolean);
  const first = (lines[0] || '').replace(/\s*(--|—|–)\s*/, ' — ');
  if (first.length <= 80) return first;
  const cut = first.slice(0, 79);
  return cut.slice(0, Math.max(cut.lastIndexOf(' '), 30)).trim() + '…';
};

async function fetchBuf(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!r.ok) throw new Error(`${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}
async function savePhoto(url, out, max) {
  if (fs.existsSync(out)) return true;
  try {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    await sharp(await fetchBuf(url)).rotate().resize({ width: max, height: max, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toFile(out);
    return true;
  } catch (e) { console.warn('  photo fail', out, e.message); return false; }
}
// постер из первого кадра ролика, если превью у Telegram не нашлось
async function posterFromVideo(mp4, out) {
  if (fs.existsSync(out)) return true;
  const tmp = out + '.jpg';
  try {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '0.3', '-i', mp4, '-frames:v', '1', '-vf', 'scale=1000:-2', tmp]);
    await sharp(tmp).webp({ quality: 80 }).toFile(out);
    fs.unlinkSync(tmp);
    return true;
  } catch (e) { console.warn('  poster from video fail', out, e.message.split('\n')[0]); try { fs.unlinkSync(tmp); } catch {} return false; }
}
async function saveVideo(url, out) {
  if (fs.existsSync(out)) return true;
  try {
    const buf = await fetchBuf(url);
    if (buf.length > MAX_VIDEO) { console.warn('  video too big', (buf.length / 1e6).toFixed(1), 'MB', out); return false; }
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, buf);
    return true;
  } catch (e) { console.warn('  video fail', out, e.message); return false; }
}

// даты: у продолжений альбома <time> нет — берём от ближайшего младшего id
const posts = [...dump.posts].sort((a, b) => a.id - b.id);
let lastDate = '';
for (const p of posts) { if (p.date) lastDate = p.date; else p.date = lastDate; }

let made = 0, skipped = 0;
for (const p of posts) {
  const id = p.id, m = media[id];
  if (id < SINCE || !m || hide.has(id)) continue;
  if (!m.photos.length && !m.videos.length) continue;
  if (!trusted.has(id) && isPersonal(p.text)) { skipped++; continue; }
  const photos = [], videos = [];
  for (let i = 0; i < m.photos.length; i++) {
    if (await savePhoto(m.photos[i], path.join(MEDIA_DIR, String(id), `${i + 1}.webp`), 1000)) photos.push(`/lenta-media/${id}/${i + 1}.webp`);
  }
  for (let i = 0; i < m.videos.length; i++) {
    const v = m.videos[i];
    if (!(await saveVideo(v.src, path.join(MEDIA_DIR, String(id), `v${i + 1}.mp4`)))) continue;
    const item = { src: `/lenta-media/${id}/v${i + 1}.mp4` };
    const posterPath = path.join(MEDIA_DIR, String(id), `v${i + 1}-poster.webp`);
    const ok = (v.thumb && (await savePhoto(v.thumb, posterPath, 1000))) || (await posterFromVideo(path.join(MEDIA_DIR, String(id), `v${i + 1}.mp4`), posterPath));
    if (ok) item.poster = `/lenta-media/${id}/v${i + 1}-poster.webp`;
    videos.push(item);
  }
  if (!photos.length && !videos.length) { skipped++; continue; }
  const text = cleanText(p.text);
  const fm = [
    '---',
    `id: ${id}`,
    `date: ${p.date || '2025-01-01'}`,
    `tg: "https://t.me/tak_naprimer/${id}"`,
    `title: ${JSON.stringify(titleOf(text))}`,
    `text: ${JSON.stringify(text)}`,
    `photos: ${JSON.stringify(photos)}`,
    `videos: ${JSON.stringify(videos)}`,
    caseOf.has(id) ? `case: ${JSON.stringify(caseOf.get(id))}` : null,
    '---',
  ].filter(Boolean).join('\n');
  fs.writeFileSync(path.join(OUT, `post-${id}.md`), fm + '\n');
  made++;
}
// скрытые — убрать, если страница была
for (const id of hide) { const f = path.join(OUT, `post-${id}.md`); if (fs.existsSync(f)) { fs.unlinkSync(f); console.log('removed hidden', id); } }
console.log(`lenta: ${made} posts written, ${skipped} skipped (personal/no media)`);
