import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const galleryItem = z.object({
  kind: z.enum(['image', 'video']).default('image'),
  src: z.string(),
  poster: z.string().optional(),
  title: z.string().optional(),
  caption: z.string().optional(),
  post: z.number().optional(),
  tg: z.string().optional(),
});

const cases = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/cases' }),
  schema: z.object({
    title: z.string(),
    year: z.number(),
    period: z.string().optional(),
    tags: z.array(z.string()).default([]),
    short: z.string(),
    result: z.string().optional(),
    materials: z.string().optional(),
    cover: z.string(),
    coverAlt: z.string().optional(),
    gallery: z.array(galleryItem).default([]),
    links: z.object({
      tg: z.string().optional(),
      behance: z.string().optional(),
      dprofile: z.string().optional(),
    }).default({}),
    // Презентация кейса как на Behance: модули по порядку (картинки в оригинале, заголовки, абзацы)
    presentation: z.array(z.object({
      kind: z.enum(['image', 'grid', 'heading', 'text', 'html']),
      src: z.string().optional(),
      w: z.number().optional(),
      h: z.number().optional(),
      // grid: картинки одного модуля в один ряд, ширины пропорциональны w/h (как flex-grow у Behance)
      items: z.array(z.object({ src: z.string(), w: z.number().optional(), h: z.number().optional() })).optional(),
      text: z.string().optional(),
      html: z.string().optional(),
      align: z.enum(['left', 'center', 'right']).optional(),
    })).default([]),
    // настройки проекта на Behance: фон полотна, верхний отступ, расстояние между модулями (px)
    presentationStyle: z.object({
      bg: z.string().default('#ffffff'),
      paddingTop: z.number().default(0),
      gap: z.number().default(0),
    }).optional(),
    sort: z.number().default(0),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
  }),
});

// Посты канала: один файл = одна страница /lenta/<id>/ (пишут scripts/build-lenta.mjs и крон на VPS)
const lenta = defineCollection({
  loader: glob({ pattern: 'post-*.md', base: './src/content/lenta' }),
  schema: z.object({
    id: z.number(),
    date: z.coerce.date(),
    tg: z.string(),
    title: z.string().default(''),
    text: z.string().default(''),
    photos: z.array(z.string()).default([]),
    videos: z.array(z.object({ src: z.string(), poster: z.string().optional() })).default([]),
    case: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { cases, lenta };
