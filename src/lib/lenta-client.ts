// Разметка карточек ленты — одна на сборку (Astro, set:html) и на клиентское обновление из /lenta/feed.json.
export type LentaPost = { id: number; date: string; text: string; photos: string[]; tg: string };

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const u = (p: string) => BASE + p;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

export function fmtDate(iso: string, long = false): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('ru-RU', long ? { day: 'numeric', month: 'long', year: 'numeric' } : { day: 'numeric', month: 'long' });
}

export function cardHTML(p: LentaPost, mode: 'carousel' | 'grid'): string {
  const meta = `${fmtDate(p.date, mode === 'grid')}${p.photos.length > 1 ? ` · ${p.photos.length} фото` : ''}`;
  const text = esc(p.text || 'Без подписи');
  if (mode === 'carousel') {
    return `<a href="${esc(p.tg)}" target="_blank" rel="noopener" class="card snap-start w-[78vw] shrink-0 sm:w-[340px]">
  <div class="aspect-square overflow-hidden bg-paper-2"><img src="${u(p.photos[0])}" alt="" loading="lazy" decoding="async" class="h-full w-full object-cover"></div>
  <div class="p-4"><div class="text-xs font-medium uppercase tracking-wide text-muted">${meta}</div><p class="mt-1.5 text-[15px] leading-snug text-ink-2 line-clamp-3">${text}</p></div>
</a>`;
  }
  return `<a href="${esc(p.tg)}" target="_blank" rel="noopener" class="card">
  <img src="${u(p.photos[0])}" alt="" loading="lazy" decoding="async" class="w-full">
  <div class="p-4"><div class="text-xs font-medium uppercase tracking-wide text-muted">${meta}</div><p class="mt-1.5 whitespace-pre-line text-[15px] leading-snug text-ink-2 line-clamp-6">${text}</p></div>
</a>`;
}

// На клиенте: если /lenta/feed.json (его обновляет крон на VPS) свежее собранного — перерисовать.
export async function refreshLenta(track: HTMLElement | null, mode: 'carousel' | 'grid', limit?: number): Promise<void> {
  if (!track) return;
  const first = Number(track.dataset.first || 0);
  try {
    const r = await fetch(u('/lenta/feed.json'), { cache: 'no-cache' });
    if (!r.ok) return;
    const posts = (await r.json()) as LentaPost[];
    if (!Array.isArray(posts) || !posts.length || posts[0].id <= first) return;
    track.innerHTML = posts.slice(0, limit ?? posts.length).map((p) => cardHTML(p, mode)).join('');
    track.dataset.first = String(posts[0].id);
  } catch {
    /* сеть недоступна — остаётся собранная версия */
  }
}
