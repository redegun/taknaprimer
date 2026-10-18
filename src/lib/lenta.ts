import { getCollection, type CollectionEntry } from 'astro:content';

export type LentaEntry = CollectionEntry<'lenta'>;

export async function getLenta(): Promise<LentaEntry[]> {
  const all = await getCollection('lenta', ({ data }) => !data.draft);
  return all.sort((a, b) => b.data.id - a.data.id);
}

export function fmtDate(d: Date, long = false): string {
  return d.toLocaleDateString('ru-RU', long ? { day: 'numeric', month: 'long', year: 'numeric' } : { day: 'numeric', month: 'long' });
}

export function postTitle(e: LentaEntry): string {
  return e.data.title || `Из канала, ${fmtDate(e.data.date, true)}`;
}

export const postUrl = (e: LentaEntry) => `/lenta/${e.data.id}/`;

// Голые ссылки в тексте поста → кликабельные (текст экранируется)
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
export function linkify(text: string): string {
  return esc(text).replace(/(https?:\/\/[^\s<]+)/g, (m) => `<a href="${m}" target="_blank" rel="noopener" class="underline decoration-line underline-offset-4 hover:text-accent break-all">${m}</a>`);
}
