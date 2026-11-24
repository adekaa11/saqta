# Saqta — фронт

```
npm install
npm run dev          # http://localhost:5173
```

## Моки и реальный бэк
Создай `.env` (образец в `.env.example`):
- `VITE_USE_MOCK=true` — всё работает без бэка. Алерты хранятся в localStorage, поэтому две вкладки (апа и сын) видят друг друга.
- `VITE_USE_MOCK=false` + `VITE_API_URL=https://<render-url>` — бэк Дана.

## Запись демо
- `http://localhost:5173/?demo=1#/check` — голос в демо-режиме: заготовленная расшифровка печатается сама (надёжно для видео).
- Без `?demo=1` работает настоящее распознавание речи (Chrome, kk-KZ / ru-RU). Если оно падает, включается тот же демо-режим.
- Окно 1: `#/check` (апа, узкое окно как телефон). Окно 2: `#/family` (сын), один раз нажать «Дыбысты қосу», чтобы был звук.
- Сброс демо-алертов — ссылка `reset` внизу страницы.

## Бэк
`server/handler.js` — одна функция Vercel на все `/api/*` по контракту из `../PLAN.md`. Движок анализа общий с фронтом (`src/engine.js`). Алерты хранятся в Upstash Redis (переменные `KV_REST_API_URL` / `KV_REST_API_TOKEN` подключены в Vercel). `GET /api/health` показывает `storage: "redis"`.

## Деплой (Vercel, проект saqta)
Локальные билдеры Vercel на Windows падают на симлинках, поэтому собираем готовый вывод сами:

```
npx vite build
node scripts/build-vercel.mjs
cd deploy
npx vercel@latest deploy --prebuilt --prod --yes
```

`.env.production` включает реальный API (`VITE_USE_MOCK=false`, тот же домен). Если сервер не отвечает, фронт сам переходит на моки.
