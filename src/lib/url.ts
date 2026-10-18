// Все внутренние ссылки и пути к /public — через u(), чтобы превью в подпапке (SITE_BASE) работало.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

export function u(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return BASE + (path.startsWith('/') ? path : '/' + path);
}

// Путь к файлу из /public с версией по содержимому: ?v=<hash>. Картинки/SVG кэшируются на неделю (.htaccess),
// без версии браузер показывает старый файл после перегенерации (так было с глифами алфавита).
const verCache = new Map<string, string>();
export function uv(path: string): string {
  let v = verCache.get(path);
  if (!v) {
    try {
      v = createHash('md5').update(readFileSync(new URL('../../public' + path, import.meta.url))).digest('hex').slice(0, 8);
    } catch {
      v = '0';
    }
    verCache.set(path, v);
  }
  return `${u(path)}?v=${v}`;
}

export const SITE = {
  name: 'Так, например',
  person: 'Татьяна Кочнева',
  tagline: 'Буквы, айдентика и объекты',
  tg: 'https://t.me/taknaprimer',
  channel: 'https://t.me/tak_naprimer',
  email: 'taknaprimer@yandex.ru',
  behance: 'https://www.behance.net/gallery/235462227/bkvch-2025-kitajschina',
};
