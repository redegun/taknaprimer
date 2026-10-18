// Стикеры Тани — квадраты 6×6 из её листа печати (public/decor/stickers/NNN.webp, нарезка scripts из EPS).
// Номера — по контакт-листу. Отобранные для декора сайта.
export const STICKERS = {
  badges: ['013', '014', '015', '262', '264'],
  letters: ['002', '004', '012', '022', '025', '029', '051', '053', '056', '067', '069', '074', '075', '078', '090', '095', '097', '099', '100', '103', '115', '134', '136', '163', '165', '172', '198', '200', '205', '206', '215', '234', '246', '248', '255', '261'],
  words: ['125', '133', '145', '147', '153', '171', '164', '032'],
};

export const stickerSrc = (id: string) => `/decor/stickers/${id}.webp`;

export type StickerPlacement = {
  id: string;     // номер квадрата-стикера (webp) — или любой src ниже
  src?: string;   // векторный элемент из /decor/vector/*.svg (без тени и скругления)
  x: string;      // left в % или px (css)
  y: string;      // top
  size: number;   // px
  rot: number;    // deg
  depth?: number; // сила параллакса 0..1
  mobile?: boolean; // показывать на телефоне
};

// Раскладки для конкретных мест
export const vec = (id: string) => `/decor/vector/${id}.svg`;

export const HERO_STICKERS: StickerPlacement[] = [
  { id: '013', x: '88%', y: '10%', size: 120, rot: -12, depth: 0.6, mobile: true },
  { id: '074', x: '94%', y: '46%', size: 150, rot: 9, depth: 0.9 },
  { id: '090', x: '66%', y: '72%', size: 110, rot: 15, depth: 0.4 },
  { id: '255', x: '82%', y: '88%', size: 96, rot: -20, depth: 0.7, mobile: true },
  { id: '125', x: '4%', y: '84%', size: 104, rot: -8, depth: 0.5 },
  // векторные бейджи из её листа: красное сердце-пружинка, искра, розовая звезда, буква
  { id: 'v039', src: vec('v039'), x: '58%', y: '14%', size: 90, rot: -8, depth: 1, mobile: true },
  { id: 'v043', src: vec('v043'), x: '97%', y: '22%', size: 56, rot: 0, depth: 0.3 },
  { id: 'v351', src: vec('v351'), x: '48%', y: '90%', size: 70, rot: 12, depth: 0.8 },
  { id: 'v547', src: vec('v547'), x: '26%', y: '14%', size: 84, rot: -16, depth: 0.5 },
];

// Стикеры поверх больших кейсов на главной (ключ — slug кейса). Координаты — от краёв полотна.
export const CASE_STICKERS: Record<string, StickerPlacement[]> = {
  kitayschina: [
    { id: '075', x: '6%', y: '18%', size: 150, rot: -14, depth: 0.8, mobile: true },
    { id: '022', x: '93%', y: '78%', size: 130, rot: 11, depth: 0.6 },
    { id: '014', x: '82%', y: '10%', size: 110, rot: 7, depth: 0.4 },
    { id: 'v549', src: vec('v549'), x: '40%', y: '94%', size: 120, rot: -6, depth: 0.9 },
    { id: 'v004', src: vec('v004'), x: '60%', y: '8%', size: 70, rot: 0, depth: 0.5, mobile: true },
    { id: 'v036', src: vec('v036'), x: '12%', y: '92%', size: 70, rot: 10, depth: 0.6 },
  ],
  '36-days-of-type-2021': [
    { id: '248', x: '96%', y: '14%', size: 120, rot: 12, depth: 0.7 },
    { id: '200', x: '55%', y: '92%', size: 110, rot: -10, depth: 0.5, mobile: true },
    { id: 'v393', src: vec('v393'), x: '46%', y: '10%', size: 72, rot: 0, depth: 0.4, mobile: true },
    { id: 'v369', src: vec('v369'), x: '4%', y: '86%', size: 64, rot: 0, depth: 0.5 },
  ],
  'inktober-2025': [
    { id: 'v374', src: vec('v374'), x: '4%', y: '10%', size: 54, rot: 0, depth: 0.5 },
    { id: 'v011', src: vec('v011'), x: '96%', y: '88%', size: 72, rot: 15, depth: 0.7, mobile: true },
  ],
};

export const MARQUEE_STICKERS =['002', '013', '022', '133', '056', '248', '095', '014', '145', '206', '053', '171', '099', '015', '163', '246', '125', '075', '200', '147', '103', '262', '067', '153', '198', '134', '029', '255', '164', '004'];
