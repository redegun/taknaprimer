import { MeshGradient } from '@paper-design/shaders-react';
import { motion, useReducedMotion } from 'motion/react';

const TITLE = 'Так, например';

function Letters({ text, delay = 0 }: { text: string; delay?: number }) {
  const reduce = useReducedMotion();
  const chars = Array.from(text);
  return (
    <span aria-label={text} role="text" className="inline-block">
      {chars.map((ch, i) => (
        <motion.span
          key={i}
          className="inline-block will-change-transform"
          initial={reduce ? false : { opacity: 0, y: '0.55em', rotate: -8, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, rotate: 0, filter: 'blur(0px)' }}
          transition={{ delay: delay + i * 0.045, duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
        >
          {ch === ' ' ? ' ' : ch}
        </motion.span>
      ))}
    </span>
  );
}

export default function Hero({ base = '/' }: { base?: string }) {
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
          <Letters text={TITLE} />
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
