import { getCollection, type CollectionEntry } from 'astro:content';

export type LentaEntry = CollectionEntry<'lenta'>;

// Импортируется и в getStaticPaths (там переменные модуля страницы недоступны)
export const PAGE_SIZE = 36;

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

// alt картинки поста (#5384): подпись поста; у буквенных постов («и», «Ё») и постов без подписи —
// с названием кейса, а не голая буква или «Из канала, <дата>»
export function postAlt(e: LentaEntry, caseTitle?: string): string {
  const t = (e.data.title ?? '').trim();
  if (t.length > 3) return t;
  if (t) return caseTitle ? `«${t}» — ${caseTitle}` : `«${t}»`;
  return caseTitle ? `${caseTitle} — фото из канала, ${fmtDate(e.data.date, true)}` : postTitle(e);
}

// alt обложки кейса (#5384): у кейса-буквы («Ё») — «Буква «Ё»», а не одна буква
export const caseCoverAlt = (d: { title: string; coverAlt?: string }) => d.coverAlt ?? (/^\p{L}$/u.test(d.title.trim()) ? `Буква «${d.title.trim()}»` : d.title);

export const postUrl = (e: LentaEntry) => `/lenta/${e.data.id}/`;

// Голые ссылки в тексте поста → кликабельные (текст экранируется)
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
export function linkify(text: string): string {
  return esc(text).replace(/(https?:\/\/[^\s<]+)/g, (m) => `<a href="${m}" target="_blank" rel="noopener" class="underline decoration-line underline-offset-4 hover:text-accent break-all">${m}</a>`);
}
