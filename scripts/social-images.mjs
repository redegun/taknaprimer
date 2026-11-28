// Своя og:image 1200×630 JPG у каждой страницы (#5106, по образцу omodox #4978).
// Layout кладёт в <head> служебную <meta name="tn-social"> с данными карточки (название, раздел, фото, оффер);
// после сборки интеграция рисует картинку в dist/og/<страница>-<хэш>.jpg, подменяет og:image, og:image:width/height,
// og:image:alt и twitter:image и убирает служебную meta. JSON-LD не трогает: в нём остаётся фото страницы (Discover #2122).
// Хэш — от версии дизайна, текстов и байтов фото: сменилось название или фото — новый URL, мессенджеры перечитают превью.
// Fail-open: любая ошибка страницы или шрифтов — у страницы остаётся прежняя og:image, сборка не падает.
//
// Две раскладки:
//  card  — бумажный фон сайта, логотип, плашка раздела, крупное название (Unbounded), оффер, фото или коллаж справа;
//  photo — кейсы и посты со своим фото от 1200 px (узел JSON-LD, ветка Discover): работа целиком на размытом фоне
//          из неё же и маленькая плашка бренда — без заголовка: Google просит не ставить в og:image картинки с текстом.
import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import * as fontkit from 'fontkit';
import sharp from 'sharp';

const VERSION = 'og1';
const W = 1200;
const H = 630;
const C = { paper: '#faf8f3', paper2: '#f1ede4', ink: '#141414', ink2: '#3a3734', muted: '#726c64', line: '#e3ddd2', accent: '#e5392c' };
const ORIGIN = 'https://taknaprimer.ru';
// Медиа ленты не в git: при сборке на раннере берём их с живого сайта (крон заливает медиа до пуша) и кэшируем здесь
const CACHE = join(tmpdir(), 'taknaprimer-og');
const CACHE_DAYS = 14;
const MAX_BYTES = 300 * 1024;
const publicDir = fileURLToPath(new URL('../public/', import.meta.url));
const fontDir = (pkg) => fileURLToPath(new URL(`../node_modules/@fontsource-variable/${pkg}/files/`, import.meta.url));

const sha = (v) => createHash('sha256').update(v).digest('hex');
const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const decode = (v) => v.replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (e, k) => {
  if (k[0] === '#') return String.fromCodePoint(k[1].toLowerCase() === 'x' ? parseInt(k.slice(2), 16) : Number(k.slice(1)));
  return { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' }[k.toLowerCase()] ?? e;
});
// эмодзи и служебные символы: в шрифтах сайта их нет
const clean = (v) => decode(String(v ?? ''))
  .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{FE0E}\u{200D}\u{20E3}]/gu, ' ')
  .replace(/[\s\u00a0]+/g, ' ')
  .replace(/\s+([»).,!?:;…])/g, '$1').replace(/([«(])\s+/g, '$1')
  .trim();

const metaRe = (key, attr = 'property') => new RegExp(`<meta\\s+${attr}="${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\s+content="([^"]*)"\\s*/?>`);
const getMeta = (html, key, attr) => decode(html.match(metaRe(key, attr))?.[1] ?? '');

async function loadFamily(pkg) {
  return Promise.all(['cyrillic', 'latin', 'cyrillic-ext', 'latin-ext'].map(async (s) =>
    fontkit.create(await readFile(join(fontDir(pkg), `${pkg}-${s}-wght-normal.woff2`)))));
}

function typography(families) {
  const inst = new Map();
  const glyphPaths = new Map();
  const fonts = (fam, wght) => {
    const k = fam + wght;
    if (!inst.has(k)) inst.set(k, families[fam].map((f) => f.getVariation({ wght })));
    return inst.get(k);
  };
  // текст режется на куски по подмножествам шрифта (кириллица и латиница — разные файлы fontsource), кернинг — внутри куска
  function shape(value, size, fam, wght) {
    const list = fonts(fam, wght);
    const runs = [];
    for (const ch of value) {
      const fi = list.findIndex((f) => f.hasGlyphForCodePoint(ch.codePointAt(0)));
      if (fi < 0) continue;
      const last = runs.at(-1);
      if (last && last.fi === fi) last.text += ch;
      else runs.push({ fi, text: ch });
    }
    let x = 0;
    const paths = [];
    for (const r of runs) {
      const font = list[r.fi];
      const scale = size / font.unitsPerEm;
      const { glyphs, positions } = font.layout(r.text);
      glyphs.forEach((g, i) => {
        const key = `${fam}${wght}:${r.fi}:${g.id}`;
        if (!glyphPaths.has(key)) glyphPaths.set(key, g.path.toSVG());
        const d = glyphPaths.get(key);
        const p = positions[i];
        if (d) paths.push(`<path d="${d}" transform="translate(${(x + p.xOffset * scale).toFixed(2)} ${(-p.yOffset * scale).toFixed(2)}) scale(${scale.toFixed(5)} ${(-scale).toFixed(5)})"/>`);
        x += p.xAdvance * scale;
      });
    }
    return { width: x, paths };
  }
  const text = (value, x, baseline, size, fam, wght, color) =>
    `<g fill="${color}" transform="translate(${x.toFixed(1)} ${baseline.toFixed(1)})">${shape(value, size, fam, wght).paths.join('')}</g>`;
  const width = (value, size, fam, wght) => shape(value, size, fam, wght).width;

  // перенос по пробелам и после дефиса внутри слова («Художник-|дизайнер»), посимвольно — только если слово шире строки
  function wrap(value, maxW, size, fam, wght) {
    const lines = [];
    let line = '';
    let broken = false;
    const tokens = value.split(' ').flatMap((w) => w.split(/(?<=[^\s-]-)(?=[^\s-])/).map((part, i) => ({ part, sep: i ? '' : ' ' })));
    for (const { part: word, sep } of tokens) {
      const next = line ? `${line}${sep}${word}` : word;
      if (line && width(next, size, fam, wght) > maxW) { lines.push(line); line = word; } else line = next;
      while (width(line, size, fam, wght) > maxW && line.length > 1) {
        broken = true;
        let cut = line.length - 1;
        while (cut > 1 && width(line.slice(0, cut), size, fam, wght) > maxW) cut--;
        lines.push(line.slice(0, cut));
        line = line.slice(cut);
      }
    }
    const out = [...lines, line].filter(Boolean);
    out.broken = broken;
    return out;
  }
  // кегль уменьшается от max до min, пока текст не влезет в maxLines; не влез — многоточие
  function block(value, { x, y, maxW, max, min, maxLines, fam, wght, color, leading = 1.12 }) {
    let size = max;
    let lines = wrap(value, maxW, size, fam, wght);
    while (lines.length > maxLines && size > min) lines = wrap(value, maxW, (size -= 2), fam, wght);
    if (lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      let last = lines[maxLines - 1].replace(/[\s,.;:—–-]+$/, '');
      while (last.length > 1 && width(`${last}…`, size, fam, wght) > maxW) last = last.slice(0, -1).replace(/[\s,.;:—–-]+$/, '');
      lines[maxLines - 1] = `${last}…`;
    }
    const lh = Math.round(size * leading);
    return {
      art: lines.map((l, i) => text(l, x, y + i * lh, size, fam, wght, color)).join(''),
      bottom: y + (lines.length - 1) * lh, size, lines: lines.length,
    };
  }
  // заголовок: самый крупный кегль, при котором текст влезает в maxLines и низ не ниже maxBottom; первая строка — от top
  function fit(value, { x, top, maxW, max, min, maxLines, maxBottom, fam, wght, color, leading = 1.1 }) {
    for (let size = max; size >= min; size -= 2) {
      const lines = wrap(value, maxW, size, fam, wght);
      const lh = Math.round(size * leading);
      const first = top + size * 0.9;
      // слово, разорванное посимвольно, — только если мельче уже нельзя
      if (lines.length <= maxLines && first + (lines.length - 1) * lh <= maxBottom && (!lines.broken || size - 2 < min)) {
        return { art: lines.map((l, i) => text(l, x, first + i * lh, size, fam, wght, color)).join(''), bottom: first + (lines.length - 1) * lh, size };
      }
    }
    const lh = Math.round(min * leading);
    const first = top + min * 0.9;
    const fitLines = Math.max(1, Math.min(maxLines, Math.floor((maxBottom - first) / lh) + 1));
    return block(value, { x, y: first, maxW, max: min, min, maxLines: fitLines, fam, wght, color, leading });
  }
  return { text, width, block, fit };
}

const rect = (x, y, w, h, r, fill, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"${extra}/>`;
const svg = (body) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${body}</svg>`);

// Логотип как в шапке сайта: «Так,» чёрным, «например» красным, Unbounded Bold
function logo(t, x, baseline, size) {
  const first = 'Так,';
  const gap = size * 0.3;
  return t.text(first, x, baseline, size, 'display', 700, C.ink) + t.text('например', x + t.width(first, size, 'display', 700) + gap, baseline, size, 'display', 700, C.accent);
}
const logoWidth = (t, size) => t.width('Так,', size, 'display', 700) + size * 0.3 + t.width('например', size, 'display', 700);

async function rounded(buf, w, h, r) {
  const mask = Buffer.from(`<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${r}" fill="#fff"/></svg>`);
  return sharp(buf).ensureAlpha().composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
}
const cover = (buf, w, h) => sharp(buf, { failOn: 'none' }).rotate().resize(w, h, { fit: 'cover', position: 'centre' }).flatten({ background: C.paper2 }).toBuffer();

// Плитки фото в правой колонке: 1 — целиком, 2–3 — две колонки, 4 — сетка 2×2
async function photoPanel(photos, x, y, w, h) {
  const gap = 12;
  const n = photos.length >= 4 ? 4 : Math.min(photos.length, 2);
  const cells = n === 1 ? [[0, 0, w, h]]
    : n === 2 ? [[0, 0, (w - gap) / 2, h], [(w + gap) / 2, 0, (w - gap) / 2, h]]
      : [[0, 0, (w - gap) / 2, (h - gap) / 2], [(w + gap) / 2, 0, (w - gap) / 2, (h - gap) / 2],
        [0, (h + gap) / 2, (w - gap) / 2, (h - gap) / 2], [(w + gap) / 2, (h + gap) / 2, (w - gap) / 2, (h - gap) / 2]];
  const r = n === 1 ? 28 : 20;
  return Promise.all(cells.map(async ([cx, cy, cw, ch], i) => ({
    input: await rounded(await cover(photos[i], Math.round(cw), Math.round(ch)), Math.round(cw), Math.round(ch), r),
    left: Math.round(x + cx), top: Math.round(y + cy),
  })));
}

async function renderCard(t, d, photos) {
  const layers = [];
  const hasPhoto = photos.length > 0;
  const colW = hasPhoto ? 556 : 1072;
  if (hasPhoto) layers.push(...await photoPanel(photos, 664, 48, 488, 534));
  let art = logo(t, 64, 104, 34);
  // плашка раздела — как выбранный чипс на сайте: чёрная, светлый текст
  if (d.l) {
    const lb = t.block(d.l, { x: 84, y: 182, maxW: colW - 40, max: 26, min: 20, maxLines: 1, fam: 'sans', wght: 700, color: C.paper });
    const lw = Math.min(colW, Math.ceil(t.width(d.l, lb.size, 'sans', 700)) + 40);
    art += rect(64, 150, lw, 48, 24, C.ink) + lb.art;
  }
  // оффер (только то, что есть на странице) — под заголовком, до 2 строк; место под него резервируется заранее
  const footerY = 574;
  let offer = null;
  if (d.o) {
    // одной строкой, если влезает от 24 px; иначе две строки
    const one = [30, 28, 26, 24].find((sz) => t.width(d.o, sz, 'sans', 700) <= colW - 32);
    offer = t.block(d.o, { x: 96, y: 0, maxW: colW - 32, max: one ?? 28, min: one ?? 24, maxLines: one ? 1 : 2, fam: 'sans', wght: 700, color: C.ink2, leading: 1.25 });
  }
  const offerH = offer ? offer.bottom + 52 : 0;
  // название — главный элемент: читается в превью Telegram на телефоне (кегль до 72–84, не меньше 40)
  const heading = t.fit(d.t, { x: 64, top: 222, maxW: colW, max: hasPhoto ? 72 : 84, min: 40, maxLines: 4, maxBottom: footerY - 58 - offerH, fam: 'display', wght: 700, color: C.ink });
  art += heading.art;
  if (offer) {
    const oy = heading.bottom + 58;
    art += `<circle cx="74" cy="${oy - 10}" r="9" fill="${C.accent}"/>`;
    art += t.block(d.o, { x: 96, y: oy, maxW: colW - 32, max: offer.size, min: offer.size, maxLines: offer.bottom ? 2 : 1, fam: 'sans', wght: 700, color: C.ink2, leading: 1.25 }).art;
  }
  art += t.block('taknaprimer.ru · Татьяна Кочнева', { x: 64, y: footerY, maxW: colW, max: 26, min: 20, maxLines: 1, fam: 'sans', wght: 600, color: C.muted }).art;
  const bg = sharp({ create: { width: W, height: H, channels: 3, background: C.paper } });
  return bg.composite([...layers, { input: svg(art) }]);
}

async function renderPhoto(t, d, photo) {
  const bgImg = await sharp(photo, { failOn: 'none' }).rotate().resize(W, H, { fit: 'cover' }).blur(40).modulate({ brightness: 0.82, saturation: 0.9 }).flatten({ background: C.paper2 }).toBuffer();
  const fg = await sharp(photo, { failOn: 'none' }).rotate().resize(W, H, { fit: 'inside' }).flatten({ background: '#ffffff' }).toBuffer({ resolveWithObject: true });
  const fw = fg.info.width;
  const fh = fg.info.height;
  // плашка бренда внизу слева: логотип и раздел
  const ls = 26;
  const label = d.l || '';
  const pw = Math.ceil(Math.max(logoWidth(t, ls), label ? t.width(label, 20, 'sans', 700) : 0)) + 44;
  const ph = label ? 92 : 62;
  const px = 28;
  const py = H - 28 - ph;
  // работу сдвигаем вправо, если плашка её закрывает, а справа есть место
  let fx = Math.round((W - fw) / 2);
  if (fw < W && fx < px + pw + 24) fx = Math.min(W - fw, px + pw + 24);
  const fy = Math.round((H - fh) / 2);
  let art = rect(px, py, pw, ph, 22, C.paper, ' fill-opacity="0.96"') + logo(t, px + 22, py + 42, ls);
  if (label) art += t.block(label, { x: px + 22, y: py + 74, maxW: pw - 44, max: 20, min: 16, maxLines: 1, fam: 'sans', wght: 700, color: C.muted }).art;
  return sharp(bgImg).composite([{ input: fg.data, left: fx, top: fy }, { input: svg(art) }]);
}

function photoLoader(root) {
  const mem = new Map();
  return (p) => {
    if (!mem.has(p)) {
      mem.set(p, (async () => {
        const rel = decodeURI(String(p).split('?')[0]);
        if (!rel.startsWith('/') || rel.includes('..')) return null;
        for (const base of [root, publicDir]) {
          const f = resolve(base, `.${rel}`);
          if (f.startsWith(resolve(base)) && existsSync(f)) return readFile(f);
        }
        const cf = join(CACHE, 'src', `${sha(rel).slice(0, 24)}${rel.match(/\.\w+$/)?.[0] ?? ''}`);
        try {
          const s = await stat(cf);
          if (Date.now() - s.mtimeMs < CACHE_DAYS * 864e5) return readFile(cf);
        } catch {}
        for (let i = 0; i < 2; i++) {
          try {
            const r = await fetch(ORIGIN + encodeURI(rel), { signal: AbortSignal.timeout(15000) });
            if (r.ok) {
              const b = Buffer.from(await r.arrayBuffer());
              await mkdir(dirname(cf), { recursive: true });
              await writeFile(cf, b);
              return b;
            }
            if (r.status === 404) break;
          } catch {}
        }
        return null;
      })());
    }
    return mem.get(p);
  };
}

function section(path) {
  const [root, child] = path.split('/').filter(Boolean);
  if (!root) return 'Татьяна Кочнева, дизайнер';
  if (root === 'raboty') return child ? 'Кейс' : 'Работы';
  if (root === 'lenta') return 'Лента';
  if (root === 'merch') return 'Вещи из кейсов';
  if (root === 'obo-mne') return 'Обо мне';
  if (root === 'kontakty') return 'Контакты';
  return 'Так, например';
}

async function encode(img) {
  let jpg = await img.clone().jpeg({ quality: 86, mozjpeg: true }).toBuffer();
  if (jpg.length > MAX_BYTES) jpg = await img.clone().jpeg({ quality: 76, mozjpeg: true }).toBuffer();
  if (jpg.length > MAX_BYTES) jpg = await img.clone().jpeg({ quality: 66, mozjpeg: true }).toBuffer();
  return jpg;
}

export function replaceSocialHead(html, { url, alt }) {
  for (const [key, value, attr] of [
    ['og:image', url], ['og:image:width', W], ['og:image:height', H], ['og:image:alt', alt],
    ['twitter:image', url, 'name'],
  ]) {
    const a = attr ?? 'property';
    const tag = `<meta ${a}="${key}" content="${esc(value)}">`;
    const re = metaRe(key, a);
    if (re.test(html)) html = html.replace(re, () => tag);
    else if (key === 'og:image:alt' || key === 'og:image:width' || key === 'og:image:height') {
      // рядом с og:image, чтобы порядок тегов был привычным
      html = html.replace(/(<meta property="og:image(?::\w+)?" content="[^"]*">)(?![\s\S]*<meta property="og:image)/, (m) => m + tag);
    } else html = html.replace('</head>', () => tag + '</head>');
  }
  return html;
}

export async function renderPage({ data, path, h1, ogTitle, loadPhoto, type }) {
  const title = clean(data.t) || clean(h1) || clean(ogTitle.replace(/\s+—\s+Так, например · taknaprimer$/, '')) || 'Так, например';
  const label = clean(data.l) || section(path);
  const offer = clean(data.o);
  // одинаковые фото (серия постов с одной картинкой) в коллаж не повторяем
  const seen = new Set();
  const bufs = (await Promise.all((data.p ?? []).slice(0, 8).map(loadPhoto)))
    .filter((b) => b && !seen.has(sha(b)) && seen.add(sha(b))).slice(0, 4);
  let mode = data.m === 'photo' && bufs.length ? 'photo' : 'card';
  const d = { t: title, l: label, o: offer };
  const key = sha(JSON.stringify([VERSION, mode, d]) + bufs.map((b) => sha(b)).join(','));
  let img;
  try {
    img = mode === 'photo' ? await renderPhoto(type, d, bufs[0]) : await renderCard(type, d, bufs);
  } catch {
    // битое фото — карточка без фото
    mode = 'card';
    img = await renderCard(type, d, []);
  }
  const jpg = await encode(img);
  const slug = path.split('/').filter(Boolean).join('-').replace(/[^a-z0-9-]/gi, '-').slice(0, 60) || 'home';
  const file = `${slug}-${key.slice(0, 12)}.jpg`;
  const alt = mode === 'photo' ? `${title} — ${label}, «Так, например»` : `${title} — ${label}`;
  return { file, jpg, alt, mode, title, label };
}

export default function socialImages() {
  let base = '/';
  let site = ORIGIN;
  return {
    name: 'taknaprimer-social-images',
    hooks: {
      'astro:config:done': ({ config }) => {
        base = config.base.endsWith('/') ? config.base : `${config.base}/`;
        site = String(config.site ?? ORIGIN).replace(/\/$/, '');
      },
      'astro:build:done': async ({ dir, logger }) => {
        const root = fileURLToPath(dir);
        let type;
        try {
          type = typography({ display: await loadFamily('unbounded'), sans: await loadFamily('manrope') });
        } catch (e) {
          logger.warn(`og: шрифты не загрузились, og:image остаются прежними (${e.message})`);
          return;
        }
        const files = (await readdir(root, { recursive: true, withFileTypes: true }))
          .filter((f) => f.isFile() && f.name.endsWith('.html'))
          .map((f) => join(f.parentPath, f.name));
        const loadPhoto = photoLoader(root);
        await mkdir(join(root, 'og'), { recursive: true });
        const manifest = [];
        const failed = [];
        const t0 = Date.now();
        const metaTag = /<meta name="tn-social" content="([^"]*)"\s*\/?>/;
        for (let i = 0; i < files.length; i += 8) {
          await Promise.all(files.slice(i, i + 8).map(async (file) => {
            let html = await readFile(file, 'utf8');
            const m = html.match(metaTag);
            if (!m) return;
            const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
            const path = canonical ? new URL(canonical).pathname : '/';
            try {
              const data = JSON.parse(decode(m[1]));
              const h1 = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? '').replace(/<[^>]+>/g, ' ');
              const r = await renderPage({ data, path, h1, ogTitle: getMeta(html, 'og:title'), loadPhoto, type });
              await writeFile(join(root, 'og', r.file), r.jpg);
              const url = `${site}${base}og/${r.file}`;
              html = replaceSocialHead(html.replace(metaTag, ''), { url, alt: r.alt });
              manifest.push({ path, url, mode: r.mode, bytes: r.jpg.length, title: r.title, label: r.label });
            } catch (e) {
              html = html.replace(metaTag, '');
              failed.push(`${path}: ${e.message}`);
            }
            await writeFile(file, html);
          }));
        }
        manifest.sort((a, b) => a.path.localeCompare(b.path));
        await writeFile(join(root, 'og', 'manifest.json'), JSON.stringify({ version: VERSION, pages: manifest, failed }, null, 1));
        logger.info(`og: ${manifest.length} картинок 1200×630 за ${((Date.now() - t0) / 1000).toFixed(1)} с` + (failed.length ? `, без своей (fail-open): ${failed.length}` : ''));
        for (const f of failed) logger.warn(`og: ${f}`);
      },
    },
  };
}
