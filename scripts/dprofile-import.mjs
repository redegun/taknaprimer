// Импорт кейса с Dprofile: SSR-HTML страницы кейса → модули по порядку (image / grid / text) → картинки в public/cases/<slug>/dprofile/
// + scripts/presentation/<slug>.json (тот же формат, что у behance-import.mjs; build-content.mjs кладёт его в кейс).
// node scripts/dprofile-import.mjs --url <https://dprofile.ru/case/...> --slug <slug> [--html <локальный файл>]
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), []));
if (!args.url || !args.slug) { console.error('usage: --url <dprofile case url> --slug <case slug> [--html file]'); process.exit(1); }
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';
const MAX_W = 1600;

const html = args.html ? fs.readFileSync(args.html, 'utf8') : await (await fetch(args.url, { headers: { 'User-Agent': UA } })).text();
const a = html.indexOf('cases-content case__content');
if (a < 0) { console.error('case content not found'); process.exit(1); }
const start = html.lastIndexOf('<section', a);
// конец секции — по балансу <section>/</section>
let depth = 0, end = start;
for (const m of html.slice(start).matchAll(/<\/?section\b/g)) {
  depth += m[0] === '<section' ? 1 : -1;
  if (depth === 0) { end = start + m.index; break; }
}
const sec = html.slice(start, end);
const bg = (html.match(/backgroundColor:"(#[0-9A-Fa-f]{3,6})"/) || [, '#1E1E1E'])[1];
const rowGap = Number((sec.match(/--row-gap:(\d+)rem/) || [, 30])[1]);

// верхнеуровневые модули секции: у них scope-атрибут секции (тот же data-v, что у <section>), у вложенных в сетку — другой
// scope = последний data-v у первого модуля верхнего уровня (первый image-module — всегда верхний, обложка)
const secScope = (sec.match(/<div class="(?:image|text|grid)-module[^"]*"[^>]*?(data-v-[0-9a-f]+)>/) || [])[1];
const topRe = new RegExp(`<div class="(?:image-module|text-module|grid-module)[^"]*"[^>]*${secScope}[^>]*>`, 'g');
const starts = [...sec.matchAll(topRe)].map((m) => m.index);
const parts = starts.map((s, i) => sec.slice(s, starts[i + 1] ?? sec.length));
console.log('section scope', secScope, 'top modules', parts.length);

// чистка текста: p/br/strong/em + span с цветом и размером (Dprofile пишет размер в rem, где 1rem = 1px макета)
const decode = (s) => s.replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
function textHtml(chunk) {
  const body = (chunk.match(/<article>([\s\S]*?)<\/article>/) || [, ''])[1];
  const out = [], stack = [];
  for (const m of body.matchAll(/<\/?([a-zA-Z0-9]+)([^>]*)>|([^<]+)/g)) {
    if (m[3] !== undefined) { out.push(decode(m[3])); continue; }
    const tag = m[1].toLowerCase(), attrs = m[2] || '', closing = m[0].startsWith('</');
    if (tag === 'br') { out.push('<br>'); continue; }
    const name = tag === 'b' ? 'strong' : tag === 'i' ? 'em' : tag === 'p' || tag === 'div' ? 'div' : tag;
    if (!['div', 'span', 'strong', 'em', 'a'].includes(name)) continue;
    if (closing) { const i = stack.lastIndexOf(name); if (i === -1) continue; while (stack.length > i) out.push(`</${stack.pop()}>`); continue; }
    const st = (attrs.match(/style="([^"]*)"/) || [, ''])[1];
    let open;
    if (name === 'span') {
      const fs_ = st.match(/font-size:\s*(\d+)rem/), col = st.match(/color:\s*(rgb\([^)]*\)|#[0-9a-fA-F]{3,6})/), bold = /font-weight:\s*(bold|[6-9]00)/.test(st);
      const cls = [bold ? 'be-bold' : '', fs_ ? 'be-fs' : ''].filter(Boolean), sty = [fs_ ? `--fs:${fs_[1]}` : '', col ? `color:${col[1]}` : ''].filter(Boolean);
      open = `<span${cls.length ? ` class="${cls.join(' ')}"` : ''}${sty.length ? ` style="${sty.join(';')}"` : ''}>`;
    } else if (name === 'a') {
      const h = attrs.match(/href="([^"]+)"/); if (!h) continue;
      open = `<a href="${h[1]}" target="_blank" rel="noopener">`;
    } else if (name === 'div') {
      const ta = st.match(/text-align:\s*(left|center|right)/);
      open = `<div class="be-p"${ta ? ` style="text-align:${ta[1]}"` : ''}>`;
    } else open = `<${name}>`;
    out.push(open); stack.push(name);
  }
  while (stack.length) out.push(`</${stack.pop()}>`);
  return out.join('').replace(/<div class="be-p">(\s|<br>)*<\/div>/g, '').trim();
}

async function fetchBuf(url, tries = 4) {
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, Referer: 'https://dprofile.ru/' } });
      if (!r.ok) throw new Error(String(r.status));
      return Buffer.from(await r.arrayBuffer());
    } catch (e) {
      if (i >= tries - 1) throw e;
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
}
const outDir = path.join(ROOT, 'public/cases', args.slug, 'dprofile');
fs.mkdirSync(outDir, { recursive: true });
let n = 0;
async function saveImg(src) {
  n++;
  const isGif = /\.gif(\?|$)/i.test(src);
  const name = `${String(n).padStart(3, '0')}.${isGif ? 'gif' : 'webp'}`;
  const out = path.join(outDir, name);
  if (!fs.existsSync(out)) {
    const buf = await fetchBuf(src);
    if (isGif) fs.writeFileSync(out, buf);
    else await sharp(buf).rotate().resize({ width: MAX_W, withoutEnlargement: true }).webp({ quality: 84 }).toFile(out);
  }
  const meta = await sharp(out).metadata().catch(() => ({}));
  return { src: `/cases/${args.slug}/dprofile/${name}`, w: meta.width, h: meta.pageHeight ?? meta.height };
}

const blocks = [];
for (const p of parts) {
  if (p.startsWith('<div class="text-module')) {
    const h = textHtml(p);
    const plain = h.replace(/<[^>]+>/g, '').trim();
    if (!plain) continue;
    const align = (p.match(/text-module_position_(center|left|right)/) || [, 'left'])[1];
    blocks.push({ kind: 'html', html: h, text: plain, align });
  } else if (p.startsWith('<div class="grid-module')) {
    const srcs = [...p.matchAll(/<img src="(https:\/\/cdn\.dprofile\.ru\/[^"]+CASE_IMAGE[^"]+)"/g)].map((m) => m[1]);
    const items = [];
    for (const s of srcs) { try { items.push(await saveImg(s)); } catch (e) { console.warn('fail', s, e.message); } }
    if (items.length === 1) blocks.push({ kind: 'image', ...items[0] });
    else if (items.length > 1) blocks.push({ kind: 'grid', items });
  } else {
    const s = (p.match(/<img src="(https:\/\/cdn\.dprofile\.ru\/[^"]+CASE_IMAGE[^"]+)"/) || [])[1];
    if (!s) continue;
    try { blocks.push({ kind: 'image', ...(await saveImg(s)) }); } catch (e) { console.warn('fail', s, e.message); }
  }
}
fs.mkdirSync(path.join(ROOT, 'scripts/presentation'), { recursive: true });
const styles = { bg, paddingTop: 0, gap: Math.min(rowGap, 60) };
fs.writeFileSync(path.join(ROOT, 'scripts/presentation', `${args.slug}.json`), JSON.stringify({ dprofile: args.url, styles, blocks }, null, 1));
const imgs = blocks.reduce((k, b) => k + (b.kind === 'grid' ? b.items.length : b.kind === 'image' ? 1 : 0), 0);
console.log(`${args.slug}: ${blocks.length} blocks — ${imgs} images (${blocks.filter((b) => b.kind === 'grid').length} grids), ${blocks.filter((b) => b.kind === 'html').length} text; bg ${bg}, gap ${styles.gap}`);
