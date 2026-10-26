// Тяжёлые GIF → анимированный WebP (тот же размер кадра, все кадры), обновляет ссылки в scripts/presentation/<slug>.json.
// node scripts/gif-to-webp.mjs <slug> [папка внутри public/cases/<slug>, по умолчанию dprofile]
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

sharp.cache(false); // на Windows кэш держит файл открытым → unlink EBUSY
const [slug, sub = 'dprofile'] = process.argv.slice(2);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const dir = path.join(ROOT, 'public/cases', slug, sub);
const presPath = path.join(ROOT, 'scripts/presentation', `${slug}.json`);
let pres = fs.readFileSync(presPath, 'utf8');
let before = 0, after = 0;
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.gif'))) {
  const src = path.join(dir, f), out = src.replace(/\.gif$/, '.webp');
  before += fs.statSync(src).size;
  await sharp(fs.readFileSync(src), { animated: true, limitInputPixels: false }).resize({ width: 1200, withoutEnlargement: true }).webp({ quality: 72, effort: 4 }).toFile(out);
  after += fs.statSync(out).size;
  fs.unlinkSync(src);
  pres = pres.split(`/cases/${slug}/${sub}/${f}`).join(`/cases/${slug}/${sub}/${f.replace(/\.gif$/, '.webp')}`);
}
fs.writeFileSync(presPath, pres);
console.log(`gif → webp: ${(before / 1e6).toFixed(1)} MB → ${(after / 1e6).toFixed(1)} MB`);
