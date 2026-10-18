import { useEffect, useRef, useState } from 'react';
import { MeshGradient } from '@paper-design/shaders-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

const TITLE = 'Так, например';

export type Glyph = { kind: 'svg' | 'tile'; src: string; set: string };
export type GlyphMap = Record<string, Glyph[]>;

const MAX_SWAPS = 3;

// Заголовок: буквы появляются по одной, затем случайные буквы подменяются глифами из нарисованных алфавитов Тани
function Letters({ text, delay = 0, glyphs }: { text: string; delay?: number; glyphs: GlyphMap }) {
  const reduce = useReducedMotion();
  const chars = Array.from(text);
  const [swaps, setSwaps] = useState<Record<number, Glyph>>({});
  const swapsRef = useRef(swaps);
  swapsRef.current = swaps;
  const timers = useRef(new Set<number>());

  const swappable = chars.map((c, i) => (glyphs[c.toLowerCase()]?.length ? i : -1)).filter((i) => i >= 0);
  const variantFor = (i: number) => {
    const v = glyphs[chars[i].toLowerCase()];
    return v[Math.floor(Math.random() * v.length)];
  };
  const unswap = (i: number) => setSwaps((s) => { const n = { ...s }; delete n[i]; return n; });
  const swap = (i: number, ttl: number) => {
    setSwaps((s) => ({ ...s, [i]: variantFor(i) }));
    const t = window.setTimeout(() => { timers.current.delete(t); unswap(i); }, ttl);
    timers.current.add(t);
  };
  const pickFree = () => {
    const free = swappable.filter((i) => !(i in swapsRef.current));
    return free.length ? free[Math.floor(Math.random() * free.length)] : null;
  };

  useEffect(() => {
    if (!swappable.length) return;
    if (reduce) {
      // без анимации: две буквы подменены статично
      const n: Record<number, Glyph> = {};
      const pool = [...swappable];
      for (let k = 0; k < 2 && pool.length; k++) {
        const i = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
        n[i] = variantFor(i);
      }
      setSwaps(n);
      return;
    }
    const tick = () => {
      if (Object.keys(swapsRef.current).length >= MAX_SWAPS) return;
      const i = pickFree();
      if (i !== null) swap(i, 3200 + Math.random() * 2600);
    };
    const start = window.setTimeout(tick, 1500 + delay * 1000);
    const iv = window.setInterval(tick, 2000);
    const tm = timers.current;
    return () => { clearTimeout(start); clearInterval(iv); tm.forEach(clearTimeout); tm.clear(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <span aria-label={text} role="text" className="inline-block">
      {chars.map((ch, i) => {
        const g = swaps[i];
        const upper = ch !== ch.toLowerCase();
        // глифы тоньше жирного Unbounded — даём им чуть больше роста, чем у буквы
        const h = upper ? '0.84em' : '0.7em';
        return (
          <motion.span
            key={i}
            className="relative inline-block will-change-transform"
            initial={reduce ? false : { opacity: 0, y: '0.55em', rotate: -8, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, rotate: 0, filter: 'blur(0px)' }}
            transition={{ delay: delay + i * 0.045, duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
            onPointerEnter={() => { if (swappable.includes(i) && !(i in swapsRef.current)) swap(i, 4000); }}
          >
            <span className="inline-block transition-[opacity,transform] duration-300" style={g ? { opacity: 0, transform: 'scale(0.6)' } : undefined}>
              {ch === ' ' ? ' ' : ch}
            </span>
            <AnimatePresence>
              {g && (
                <motion.img
                  key={g.src}
                  src={g.src}
                  alt=""
                  title={g.set}
                  className={g.kind === 'tile' ? 'pointer-events-none absolute left-1/2 rounded-[14%] object-cover shadow-[0_8px_20px_rgba(0,0,0,0.18)]' : 'pointer-events-none absolute left-1/2 object-contain'}
                  style={g.kind === 'tile' ? { bottom: '0.12em', height: h, width: h } : { bottom: '0.14em', height: h, width: '100%' }}
                  initial={{ opacity: 0, scale: 0.4, rotate: -16, x: '-50%' }}
                  animate={{ opacity: 1, scale: 1, rotate: 0, x: '-50%' }}
                  exit={{ opacity: 0, scale: 0.5, rotate: 14, x: '-50%' }}
                  transition={{ type: 'spring', stiffness: 420, damping: 24 }}
                />
              )}
            </AnimatePresence>
          </motion.span>
        );
      })}
    </span>
  );
}

export default function Hero({ base = '/', glyphs = {} }: { base?: string; glyphs?: GlyphMap }) {
  const b = base.replace(/\/$/, '');
  return (
    <section className="relative isolate overflow-hidden">
      <div className="absolute inset-0 -z-10 opacity-90" aria-hidden="true">
        <MeshGradient
          style={{ width: '100%', height: '100%' }}
          colors={['#faf8f3', '#ffe4de', '#fff2c9', '#ffd6ea', '#f6f1e6']}
          distortion={0.9}
          swirl={0.35}
          speed={0.35}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#faf8f3]" />
      </div>

      <div className="container-x py-20 sm:py-28 lg:py-36">
        <p className="mb-5 text-sm font-semibold uppercase tracking-[0.18em] text-muted">
          Татьяна Кочнева · дизайнер
        </p>
        <h1 className="font-display text-[clamp(1.9rem,8.4vw,7.5rem)] font-extrabold leading-[0.98] tracking-tight whitespace-nowrap">
          <Letters text={TITLE} glyphs={glyphs} />
        </h1>
        <motion.p
          className="mt-7 max-w-2xl text-xl leading-snug text-ink-2 sm:text-2xl"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.7 }}
        >
          Буквы, айдентика и объекты. Рисую алфавиты, собираю буквы из скотча, фольги и ткани, делаю леттеринг для упаковки, мерча и вывесок.
        </motion.p>
        <motion.div
          className="mt-9 flex flex-wrap gap-3"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1, duration: 0.7 }}
        >
          <a href={`${b}/raboty/`} className="btn btn-primary">Смотреть работы</a>
          <a href={`${b}/kontakty/#forma`} className="btn btn-ghost">Обсудить проект</a>
        </motion.div>
      </div>
    </section>
  );
}
