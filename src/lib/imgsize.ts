// Реальные размеры картинки из /public для og:image:width/height и JSON-LD.
// Файл в public/ — меряем sharp при сборке; медиа ленты (не в git) — из src/data/media-sizes.json.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import mediaSizes from '@/data/media-sizes.json';

const sizes = mediaSizes as Record<string, [number, number]>;
const cache = new Map<string, [number, number] | null>();
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

// путь вида /cases/x/1.webp (без SITE_BASE превью и без домена)
export function publicPath(p: string): string {
  let s = p.replace(/^https?:\/\/[^/]+/, '').split('?')[0];
  if (BASE && s.startsWith(BASE + '/')) s = s.slice(BASE.length);
  return s;
}

export function hasImage(p: string): boolean {
  const s = publicPath(p);
  return fs.existsSync(path.join(process.cwd(), 'public', s)) || s in sizes;
}

export async function imageSize(p: string): Promise<[number, number] | null> {
  const s = publicPath(p);
  if (cache.has(s)) return cache.get(s)!;
  let r: [number, number] | null = null;
  const file = path.join(process.cwd(), 'public', s);
  if (fs.existsSync(file)) {
    try {
      const m = await sharp(file).metadata();
      if (m.width && m.height) r = [m.width, m.height];
    } catch {}
  }
  if (!r && sizes[s]) r = sizes[s];
  cache.set(s, r);
  return r;
}
