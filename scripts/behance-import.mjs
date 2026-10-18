// Импорт кейсов с Behance: отрендеренный Chrome HTML проекта → модули по порядку (картинки в оригинале, тексты)
// → public/cases/<slug>/behance/NN.webp|gif + scripts/presentation/<slug>.json (подхватывает build-content.mjs).
// node scripts/behance-import.mjs --html <папка с <projectId>.html>
// HTML берётся из Chrome (Playwright), потому что прямые запросы Behance режет (403). Картинки: /project_modules/source/.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), []));
if (!args.html) { console.error('usage: --html <dir with <id>.html>'); process.exit(1); }
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const projects = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/behance-projects.json'), 'utf8'));
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';
const MAX_W = 1600;

const decode = (s) => s.replace(/&nbsp;| /g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/​/g, '');
// HTML текстового модуля → блоки {kind:'heading'|'text', text}
const UI_JUNK = new Set(['Поиск похожего', 'Сохранить', 'Постоянная ссылка', 'Добавить в коллекцию', 'Исходные файлы', 'Save', 'Permalink', 'Find similar']);
function textBlocks(htmlChunk) {
  // текст модуля заканчивается там, где начинается меню действий следующего модуля
  // текст модуля — до конца его контейнера (</section>), меню действий или следующего контейнера; у последнего модуля иначе прилипает подвал страницы
  const inner = htmlChunk.replace(/^[\s\S]*?module-content-text[^>]*>/, '').split(/<\/section>|project-module__actions|<section class=|Project-projectModuleContainer/)[0].replace(/<[^>]*$/, '');
  const out = [];
  // верхнеуровневые div'ы модуля
  const divs = inner.match(/<div[\s\S]*?(?=<div(?![^>]*class="(?:[^"]*\b(?:bold|texteditor)[^"]*)")|$)/g) || [inner];
  const lines = inner.replace(/<br\s*\/?>/g, '\n').replace(/<\/div>/g, '\n').replace(/<[^>]+>/g, '').split('\n').map((l) => decode(l).trim()).filter((l) => l && !UI_JUNK.has(l));
  const headingSrc = inner.match(/class="(?:title|sub-title)"[\s\S]*?<\/div>/g) || [];
  const headings = new Set(headingSrc.map((h) => decode(h.replace(/<[^>]+>/g, '')).trim()).filter(Boolean));
  const boldOnly = new Set((inner.match(/<span class="bold">[\s\S]*?<\/span>/g) || []).map((h) => decode(h.replace(/<[^>]+>/g, '')).trim()));
  let para = [];
  const flush = () => { if (para.length) { out.push({ kind: 'text', text: para.join('\n') }); para = []; } };
  for (const l of lines) {
    if (headings.has(l) || (boldOnly.has(l) && l.length < 60)) { flush(); out.push({ kind: 'heading', text: l }); }
    else para.push(l);
  }
  flush();
  return out;
}

async function fetchBuf(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Referer: 'https://www.behance.net/' } });
  if (!r.ok) throw new Error(String(r.status));
  return Buffer.from(await r.arrayBuffer());
}
// лучший доступный размер: source → fs → max_1200 → hd → как на странице
async function download(url) {
  const m = url.match(/project_modules\/([^/]+)\/(.+)$/);
  const tail = m[2];
  for (const size of ['source', 'fs', 'max_3840', 'max_1200', 'hd', m[1]]) {
    try { return { buf: await fetchBuf(`https://mir-s3-cdn-cf.behance.net/project_modules/${size}/${tail}`), size }; } catch {}
  }
  throw new Error('no size available ' + tail);
}

for (const [pid, p] of Object.entries(projects)) {
  const file = path.join(args.html, `${pid}.html`);
  if (!fs.existsSync(file)) { console.warn('no html for', pid); continue; }
  const html = fs.readFileSync(file, 'utf8');
  const outDir = path.join(ROOT, 'public/cases', p.slug, 'behance');
  fs.mkdirSync(outDir, { recursive: true });
  // Модули лежат в <section class="…project-module-container" aria-label="Project Module N">; текстовые копии вне них — SEO-дубли.
  const parts = html.split(/(?=<section class="[^"]*project-module-container"[^>]*aria-label="Project Module \d+")/).slice(1);
  const chunks = parts.map((c) => ({ n: Number(c.match(/aria-label="Project Module (\d+)"/)[1]), html: c })).sort((a, b) => a.n - b.n);
  const blocks = [];
  const seen = new Set();
  let n = 0;
  console.log('==', pid, p.slug, chunks.length, 'modules');
  for (const { html: chunk } of chunks) {
    if (/class="[^"]*project-module-text[^"]*"/.test(chunk)) { blocks.push(...textBlocks(chunk)); continue; }
    const imgs = [...chunk.matchAll(/<img[^>]*src="(https:\/\/mir-s3-cdn-cf\.behance\.net\/project_modules\/[^"]+)"/g)].map((x) => x[1]);
    for (const src of imgs) {
      const tail = src.split('/').pop();
      if (seen.has(tail)) continue;
      seen.add(tail);
      n++;
      const isGif = /\.gif$/i.test(tail);
      const outName = `${String(n).padStart(2, '0')}.${isGif ? 'gif' : 'webp'}`;
      const out = path.join(outDir, outName);
      if (!fs.existsSync(out)) {
        try {
          const { buf, size } = await download(src);
          if (isGif) fs.writeFileSync(out, buf);
          else await sharp(buf).rotate().resize({ width: MAX_W, withoutEnlargement: true }).webp({ quality: 84 }).toFile(out);
          console.log('  ', outName, size, (buf.length / 1024).toFixed(0) + 'KB');
        } catch (e) { console.warn('   fail', tail, e.message); n--; seen.delete(tail); continue; }
      }
      const meta = await sharp(out).metadata().catch(() => ({}));
      blocks.push({ kind: 'image', src: `/cases/${p.slug}/behance/${outName}`, w: meta.width, h: meta.pageHeight ?? meta.height, grid: imgs.length > 1 });
    }
  }
  const cleaned = blocks.filter((b) => b.kind !== 'text' || b.text.trim());
  fs.mkdirSync(path.join(ROOT, 'scripts/presentation'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'scripts/presentation', `${p.slug}.json`), JSON.stringify({ behance: p.url, blocks: cleaned }, null, 1));
  console.log(`   -> ${cleaned.length} blocks (${cleaned.filter((b) => b.kind === 'image').length} images, ${cleaned.filter((b) => b.kind !== 'image').length} text)`);
}
