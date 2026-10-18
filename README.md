# taknaprimer.ru — сайт Татьяны Кочневой «Так, например»

Статика на Astro 5 + React-острова (Paper Shaders, motion), Tailwind 4. Хостинг — Timeweb (шаред-аккаунт redegun, папка `taknaprimer/public_html/`).
Ветка `main` — текущий сайт. Ветка `master` — старый gulp-макет 2018 года, не используется.

## Структура

- `src/content/cases/*.md` — кейсы (генерируются из дампа канала, можно править руками).
- `src/data/lenta.json` + `public/lenta-media/` — лента из Telegram (генерируется).
- `public/cases/<slug>/` — медиа кейсов (webp ≤ 1400 px, mp4 ≤ 14 МБ).
- `public/api/form.php` — обработчик формы «Обсудить проект» (почта + Telegram через релей). Конфиг с адресами и токенами — `/home/r/redegun/taknaprimer/form-config.php` на хостинге, вне git.
- `scripts/cases.json` — какие посты канала в какой кейс, списки скрытых постов и стоп-слов.
- `scripts/build-content.mjs`, `scripts/build-lenta.mjs` — генераторы (дамп канала лежит вне репо: VPS `clients/taknaprimer/data/`).

## Команды

```bash
npm install
npm run content -- --dump <all.json> --media <media.json> --img <папка картинок>   # кейсы
npm run lenta -- --dump <all.json> --media <media.json> --limit 30                  # лента
npm run dev                      # localhost:4321
npm run build                    # прод, корень домена
npm run build:preview            # превью в /_preview/ (SITE_BASE=/_preview)
```

Telegram CDN с офисного компа доступен только через локальный прокси — генераторы запускаются с `NODE_USE_ENV_PROXY=1` (уже в npm-скриптах).

## Деплой

Сборка `dist/` заливается на Timeweb по FTP (lftp `mirror -R` без `--only-newer` и без `--delete`), только со своих раннеров office1080 — GitHub-хостинговые до Timeweb не достают. Workflow — `.github/workflows/deploy.yml` (раннер с меткой `taknaprimer-deploy` ещё не зарегистрирован).
