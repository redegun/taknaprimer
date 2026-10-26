"""Картинки для страницы мерча: кадрирует нужный товар из мокапов презентаций в public/merch/<имя>.webp.
Кадр = доли (left, top, right, bottom) исходника. Запуск из корня сайта:
  C:/Users/rede/AppData/Local/Programs/Python/Python312/python.exe -X utf8 -I scripts/merch-images.py
"""
import os
from PIL import Image

K = "public/cases/kitayschina/behance/"
D = "public/cases/analogovyy-apdeyt/dprofile/"
T = "public/cases/36-days-of-type-2021/behance/"
I = "public/cases/inktober-2025/behance/"
L = "public/lenta-media/"
OUT = "public/merch"

CROPS = {
    "hoodie-black": (K + "17.webp", (0, 0, 1, 1)),
    "hoodie-pink": (K + "07.webp", (0, 0.5, 0.5, 1)),
    "tote": (K + "07.webp", (0.5, 0.5, 1, 1)),
    "beanie": (K + "16.webp", (0.12, 0, 0.88, 1)),
    "pin": (K + "34.webp", (0.15, 0, 0.85, 1)),
    "cup": (K + "37.webp", (0.5, 0, 1, 1)),
    "socks": (K + "47.webp", (0, 0.5, 0.5, 1)),
    "laptop-kit": (K + "47.webp", (0.5, 0.5, 1, 1)),
    "poster-street": (K + "50.webp", (0.38, 0, 1, 1)),
    "tee-kit": (K + "51.webp", (0, 0.5, 0.5, 1)),
    "poster-alphabet": (K + "06.webp", (0, 0, 1, 1)),
    "laptop-skotch": (D + "010.webp", (0, 0, 1, 1)),
    "hoodie-back": (D + "024.webp", (0, 0, 0.47, 1)),
    "print-interior": (D + "043.webp", (0.18, 0, 0.82, 1)),
    "keychain": (D + "050.webp", (0, 0, 1, 1)),
    "sweat-green": (D + "056.webp", (0, 0, 0.42, 1)),
    "pendant": (D + "060.webp", (0, 0, 1, 1)),
    "sweat-patches": (D + "066.webp", (0, 0, 1, 1)),
    "jeans": (D + "067.webp", (0, 0, 1, 1)),
    "tee-back": (D + "070.webp", (0, 0, 0.25, 1)),
    "tattoo": (D + "097.webp", (0, 0, 1, 1)),
    "sweat-back": (D + "098.webp", (0, 0, 1, 1)),
    "tee-white": (D + "103.webp", (0, 0, 1, 1)),
    "tee-black": (D + "112.webp", (0, 0, 1, 1)),
    "name-poster": (T + "43.webp", (0, 0, 1, 1)),
    "print-starfish": (I + "06.webp", (0, 0, 1, 1)),
    "print-ragged": (I + "14.webp", (0, 0, 1, 1)),
    "brooch-1": (L + "561/1.webp", (0, 0, 1, 1)),
    "brooch-2": (L + "561/3.webp", (0, 0, 1, 1)),
}

os.makedirs(OUT, exist_ok=True)
for name, (src, (l, t, r, b)) in CROPS.items():
    im = Image.open(src)
    im.seek(0)
    im = im.convert("RGB")
    w, h = im.size
    c = im.crop((round(l * w), round(t * h), round(r * w), round(b * h)))
    c.thumbnail((1100, 1100))
    c.save(f"{OUT}/{name}.webp", "WEBP", quality=82)
    print(name, c.size)

# коллаж стикерпака: 3×3 стикера из листа печати с лёгким поворотом
import random
random.seed(7)
ids = ["074", "013", "022", "095", "199", "248", "163", "125", "056"]
S = 320
canvas = Image.new("RGB", (S * 3 + 80, S * 3 + 80), (241, 237, 228))
for i, sid in enumerate(ids):
    st = Image.open(f"public/decor/stickers/{sid}.webp").convert("RGBA").resize((S - 30, S - 30))
    st = st.rotate(random.uniform(-9, 9), expand=True, resample=Image.BICUBIC)
    x = 40 + (i % 3) * S + (S - st.width) // 2
    y = 40 + (i // 3) * S + (S - st.height) // 2
    canvas.paste(st, (x, y), st)
canvas.thumbnail((1000, 1000))
canvas.save(f"{OUT}/stickerpack.webp", "WEBP", quality=84)
print("stickerpack", canvas.size)
