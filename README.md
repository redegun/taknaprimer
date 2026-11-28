# taknaprimer.ru — сайт Татьяны Кочневой «Так, например»

Статика на Astro 5 + React-острова (Paper Shaders, motion), Tailwind 4. Хостинг — Timeweb (шаред-аккаунт redegun, папка `taknaprimer/public_html/`).
Ветка `main` — текущий сайт. Ветка `master` — старый gulp-макет 2018 года, не используется.

## Структура

- `src/content/cases/*.md` — кейсы (генерируются из дампа канала, можно править руками).
- `src/content/lenta/post-<id>.md` — посты канала, каждый = страница `/lenta/<id>/` (генерируются; новые дописывает крон на VPS и пушит в `main`).
- `public/lenta-media/<id>/` — фото/видео постов. **Не в git**: на хостинг заливает локальный деплой (первый раз) и крон на VPS (новые посты).
- `public/cases/<slug>/` — медиа кейсов (webp ≤ 1400 px, mp4 ≤ 14 МБ).
- `public/api/form.php` — обработчик формы «Обсудить проект» (почта + Telegram через релей). Конфиг с адресами и токенами — `/home/r/redegun/taknaprimer/form-config.php` на хостинге, вне git.
- `scripts/cases.json` — какие посты канала в какой кейс, списки скрытых постов и стоп-слов.
- `scripts/build-content.mjs`, `scripts/build-lenta.mjs` — генераторы (дамп канала лежит вне репо: VPS `clients/taknaprimer/data/`).
- `scripts/social-images.mjs` — своя og:image 1200×630 JPG у каждой страницы (#5106): интеграция Astro рисует карточки после сборки в `dist/og/<страница>-<хэш>.jpg` и подменяет `og:image`, `og:image:width/height/alt`, `twitter:image`. Данные карточки задаёт страница пропом `social` у `Layout` (название — по умолчанию H1, раздел, фото, оффер — только то, что есть на странице). Кейсы и посты со своим фото от 1200 px (ветка Discover #2122) — раскладка `photo`: работа целиком, без заголовка; JSON-LD не трогается. Медиа ленты при сборке на раннере скачиваются с живого сайта (кэш во временной папке). Ошибка — у страницы остаётся прежняя og:image (fail-open). Поменять дизайн — поднять `VERSION` в скрипте. Список картинок — `dist/og/manifest.json`.

## Команды

```bash
npm install
npm run content -- --dump <all.json> --media <media.json> --img <папка картинок>   # кейсы
npm run lenta -- --dump <all.json> --media <media.json> [--since <id>]             # страницы постов + медиа
npm run dev                      # localhost:4321
npm run build                    # прод, корень домена
npm run build:preview            # превью в /_preview/ (SITE_BASE=/_preview)
```

Telegram CDN с офисного компа доступен только через локальный прокси — генераторы запускаются с `NODE_USE_ENV_PROXY=1` (уже в npm-скриптах).

## Деплой

Сборка `dist/` заливается на Timeweb по FTP (lftp `mirror -R` без `--only-newer` и без `--delete`), только со своих раннеров office1080 — GitHub-хостинговые до Timeweb не достают. Workflow — `.github/workflows/deploy.yml` (раннер с меткой `taknaprimer-deploy` ещё не зарегистрирован).
