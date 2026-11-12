// Размеры картинок ленты для og:image:width/height. public/lenta-media не в git (живёт на хостинге),
// поэтому в CI их не измерить — снимаем локально и коммитим src/data/media-sizes.json.
// Запуск: node scripts/media-sizes.mjs (после заливки новых медиа ленты, в т.ч. og.jpg)
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const DIR = path.join(ROOT, 'public/lenta-media');
const out = {};
for (const id of fs.readdirSync(DIR).sort((a, b) => Number(a) - Number(b))) {
  const d = path.join(DIR, id);
  if (!fs.statSync(d).isDirectory()) continue;
  for (const f of fs.readdirSync(d).sort()) {
    if (!/\.(webp|jpe?g|png)$/i.test(f)) continue;
    const m = await sharp(path.join(d, f)).metadata();
    out[`/lenta-media/${id}/${f}`] = [m.width, m.height];
  }
}
fs.writeFileSync(path.join(ROOT, 'src/data/media-sizes.json'), JSON.stringify(out, null, 0) + '\n');
console.log('media-sizes:', Object.keys(out).length);
