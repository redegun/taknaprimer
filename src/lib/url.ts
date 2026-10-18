// Все внутренние ссылки и пути к /public — через u(), чтобы превью в подпапке (SITE_BASE) работало.
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

export function u(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return BASE + (path.startsWith('/') ? path : '/' + path);
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
