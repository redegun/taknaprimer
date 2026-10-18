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
