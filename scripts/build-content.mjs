// Генерация кейсов из дампа Telegram-канала.
// node scripts/build-content.mjs --dump <all.json> --media <media.json> --img <папка с картинками старого сайта>
// Дамп содержит личные посты — живёт вне репо. В репо попадают только отобранные кейсы и их медиа.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { execFileSync } from 'node:child_process';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), []));
const DUMP = args.dump, MEDIA = args.media, IMG = args.img || '';
if (!DUMP || !MEDIA) { console.error('usage: --dump all.json --media media.json [--img dir]'); process.exit(1); }

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/cases.json'), 'utf8'));
const dump = JSON.parse(fs.readFileSync(DUMP, 'utf8'));
const media = JSON.parse(fs.readFileSync(MEDIA, 'utf8'));
const posts = Object.fromEntries(dump.posts.map((p) => [p.id, p]));
const hide = new Set(cfg.hide);
const stop = cfg.stop.map((s) => s.toLowerCase());
const MAX_VIDEO = 14 * 1024 * 1024;

const expand = (list) => list.flatMap((v) => {
  if (typeof v === 'number') return [v];
  const [a, b] = v.split('-').map(Number);
  return Array.from({ length: b - a + 1 }, (_, i) => a + i);
});
const cleanText = (t) => (t || '').replace(/#[\wа-яёА-ЯЁ_]+/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim();
const isPersonal = (t) => { const l = (t || '').toLowerCase(); return stop.some((s) => l.includes(s)); };
const yaml = (s) => JSON.stringify(s);

async function fetchBuf(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return Buffer.from(await r.arrayBuffer());
}
async function saveImage(src, out, max) {
  if (fs.existsSync(out)) return true;
  try {
    const buf = typeof src === 'string' && /^https?:/.test(src) ? await fetchBuf(src) : fs.readFileSync(src);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    await sharp(buf).rotate().resize({ width: max, height: max, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toFile(out);
    return true;
  } catch (e) { console.warn('  image fail', src, e.message); return false; }
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
    if (buf.length > MAX_VIDEO) { console.warn('  video too big, skip', url.slice(0, 60), (buf.length / 1e6).toFixed(1), 'MB'); return false; }
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, buf);
    return true;
  } catch (e) { console.warn('  video fail', url.slice(0, 60), e.message); return false; }
}

// Убираем счётчик «02/33» / «3/31» и ведущие тире: «02/33 Б -- Баг. Битые пиксели…» → «Б — Баг. Битые пиксели…»
const stripCounter = (t) => (t || '').replace(/^\s*\d{1,2}\/\d{2}\s*/, '').replace(/^\s*[-—–]+\s*/, '').trim();
const shorten = (t, n) => {
  if (t.length <= n) return t;
  const cut = t.slice(0, n - 1);
  return cut.slice(0, Math.max(cut.lastIndexOf(' '), 30)).trim() + '…';
};
// Заголовок подписи: первая непустая строка после счётчика, до конца предложения.
function itemTitle(text) {
  const body = stripCounter(cleanText(text));
  const first = (body.split('\n').map((s) => s.trim()).find(Boolean) || '').replace(/\s*(--|—|–)\s*/, ' — ');
  const sentence = first.split(/(?<=[.!?])\s/)[0].replace(/[.!?]+$/, '').trim();
  return shorten(sentence, 72);
}
// Полный текст идеи без счётчика; если первая строка дублирует заголовок — убираем её.
function itemCaption(text, title) {
  const body = stripCounter(cleanText(text)).replace(/\s*--\s*/g, ' — ');
  const lines = body.split('\n');
  const first = (lines.find((s) => s.trim()) || '').trim();
  const t = title.replace(/…$/, '');
  if (first && (first === title || first.startsWith(t) || t.startsWith(first))) {
    const idx = lines.indexOf(lines.find((s) => s.trim()));
    return lines.slice(idx + 1).join('\n').trim();
  }
  return body;
}

const outDir = path.join(ROOT, 'src/content/cases');
fs.mkdirSync(outDir, { recursive: true });

for (const c of cfg.cases) {
  console.log('==', c.slug);
  const dir = path.join(ROOT, 'public/cases', c.slug);
  const gallery = [];
  let cover = null;

  if (c.files) {
    for (const f of c.files) {
      const out = path.join(dir, f.replace(/\.[a-z]+$/i, '.webp'));
      if (await saveImage(path.join(IMG, f), out, 1400)) gallery.push({ kind: 'image', src: `/cases/${c.slug}/${path.basename(out)}` });
    }
    if (c.cover?.file) cover = `/cases/${c.slug}/${c.cover.file.replace(/\.[a-z]+$/i, '.webp')}`;
  }

  const ids = c.posts ? expand(c.posts) : [];
  // Явно перечисленные id (числом, не диапазоном) — доверенные: стоп-слова к ним не применяем, только hide.
  const explicit = new Set((c.posts || []).filter((v) => typeof v === 'number'));
  for (const id of ids) {
    const p = posts[id], m = media[id];
    if (!p || !m) continue;
    if (hide.has(id)) continue;
    if (!explicit.has(id) && isPersonal(p.text)) continue;
    if (!m.photos.length && !m.videos.length) continue;
    const text = cleanText(p.text);
    const isLetter = c.letters && /^\s*\d{1,2}\/\d{2}/.test(p.text || '');
    const title = text ? itemTitle(p.text) : '';
    const caption = c.letters && isLetter ? itemCaption(p.text, title) : '';
    const tg = `https://t.me/tak_naprimer/${id}`;
    for (let i = 0; i < m.photos.length; i++) {
      const out = path.join(dir, `${id}-${i + 1}.webp`);
      if (!(await saveImage(m.photos[i], out, 1400))) continue;
      const item = { kind: 'image', src: `/cases/${c.slug}/${id}-${i + 1}.webp`, post: id, tg };
      if (title) item.title = title;
      if (caption && caption.length > 20) item.caption = caption;
      gallery.push(item);
      if (c.cover?.post === id && (c.cover.index ?? 0) === i) cover = item.src;
    }
    for (let i = 0; i < m.videos.length; i++) {
      const v = m.videos[i];
      const out = path.join(dir, `${id}-v${i + 1}.mp4`);
      if (!(await saveVideo(v.src, out))) continue;
      const item = { kind: 'video', src: `/cases/${c.slug}/${id}-v${i + 1}.mp4`, post: id, tg };
      const po = path.join(dir, `${id}-v${i + 1}-poster.webp`);
      const ok = (v.thumb && (await saveImage(v.thumb, po, 900))) || (await posterFromVideo(out, po));
      if (ok) item.poster = `/cases/${c.slug}/${id}-v${i + 1}-poster.webp`;
      if (title) item.title = title;
      gallery.push(item);
    }
  }
  if (!cover) cover = gallery.find((g) => g.kind === 'image')?.src ?? '';
  const nImg = gallery.filter((g) => g.kind === 'image').length, nVid = gallery.length - nImg;
  console.log(`   ${nImg} фото, ${nVid} видео, cover ${cover}`);

  const fm = [
    '---',
    `title: ${yaml(c.title)}`,
    `year: ${c.year}`,
    c.period ? `period: ${yaml(c.period)}` : null,
    `tags: ${JSON.stringify(c.tags)}`,
    `short: ${yaml(c.short)}`,
    c.result ? `result: ${yaml(c.result)}` : null,
    c.materials ? `materials: ${yaml(c.materials)}` : null,
    `cover: ${yaml(cover)}`,
    `links: ${JSON.stringify(c.links || {})}`,
    `sort: ${c.sort ?? 0}`,
    `featured: ${!!c.featured}`,
    'gallery:',
    ...gallery.map((g) => '  - ' + JSON.stringify(g)),
    '---',
  ].filter(Boolean).join('\n');
  fs.writeFileSync(path.join(outDir, `${c.slug}.md`), fm + '\n\n' + (c.body || '') + '\n');
}

// фото для «Обо мне» из старого сайта
if (IMG && fs.existsSync(path.join(IMG, 'face.jpg'))) {
  await saveImage(path.join(IMG, 'face.jpg'), path.join(ROOT, 'public/about/tanya.webp'), 1200);
}
console.log('done');
