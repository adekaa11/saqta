// Тест точности Saqta на наборе сообщений.
//
// 1) В Google-таблице «Saqta — 30 реальных сообщений» → Файл → Скачать → CSV.
// 2) node scripts/eval.mjs путь/к/файлу.csv [--api https://saqta-delta.vercel.app] [--pause 4]
//
// Столбцы (как в таблице): № | Текст | Язык | Мошенники или обычное | Схема | Откуда | Дата | Кто добавил
// Отчёт: ../eval/report-<дата>.md и .json (рядом с CSV не пишем, чтобы не путать).
//
// Метрики:
//  - «Предупредили» = вердикт «мошенники» или «подозрительно» (человек увидел предупреждение).
//  - Обнаружение мошенничества: доля мошеннических, где предупредили; и строгая — где сказали «мошенники».
//  - Ложные тревоги: доля обычных, где сказали «мошенники»; и мягкая — где было хоть какое-то предупреждение.
// Запросы идут с флагом eval: в статистику пилота и в тревоги семьи они не попадают.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const args = process.argv.slice(2)
const file = args.find((a) => !a.startsWith('--'))
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d }
const API = opt('api', 'https://saqta-delta.vercel.app').replace(/\/$/, '')
const PAUSE = Number(opt('pause', '4')) * 1000
const LABEL = opt('label', '')
if (!file) { console.error('Укажите CSV: node scripts/eval.mjs messages.csv'); process.exit(1) }

// CSV по RFC 4180: кавычки, запятые и переносы строк внутри ячеек
function parseCSV(s) {
  const rows = []; let row = []; let cell = ''; let q = false
  s = s.replace(/^﻿/, '')
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (q) {
      if (c === '"' && s[i + 1] === '"') { cell += '"'; i++ } else if (c === '"') q = false; else cell += c
    } else if (c === '"') q = true
    else if (c === ',') { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') { if (c === '\r' && s[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = '' }
    else cell += c
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  return rows.filter((r) => r.some((x) => x.trim()))
}

const rows = parseCSV(readFileSync(resolve(file), 'utf8'))
const head = rows.shift().map((h) => h.toLowerCase())
const col = (re) => head.findIndex((h) => re.test(h))
const iText = col(/текст/), iLabel = col(/мошенники|обычное/), iLang = col(/язык/), iScheme = col(/схема/), iSrc = col(/откуда/)
if (iText < 0 || iLabel < 0) { console.error('Нет столбцов «Текст» и «Мошенники или обычное»'); process.exit(1) }

const items = rows
  .map((r, n) => ({ n: n + 1, text: (r[iText] || '').trim(), label: (r[iLabel] || '').trim().toLowerCase(), lang: r[iLang] || '', scheme: r[iScheme] || '', src: r[iSrc] || '' }))
  .filter((x) => x.text && /мошен|обыч/.test(x.label))
  .map((x) => ({ ...x, scam: x.label.startsWith('мошен') }))

console.log(`Сообщений: ${items.length} (мошеннических ${items.filter((x) => x.scam).length}, обычных ${items.filter((x) => !x.scam).length}). API: ${API}`)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
for (const it of items) {
  const t0 = Date.now()
  let r = null
  for (let attempt = 0; attempt < 2 && !r; attempt++) {
    try {
      const res = await fetch(API + '/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: it.text, eval: true }) })
      if (res.ok) r = await res.json()
      else await sleep(3000)
    } catch { await sleep(3000) }
  }
  const out = r ? { verdict: r.verdict, score: r.risk_score, engine: r.engine, scheme_got: r.scheme?.title_ru, flags: r.red_flags?.map((f) => f.text) } : { verdict: 'error' }
  results.push({ ...it, ...out, ms: Date.now() - t0 })
  console.log(`${String(it.n).padStart(2)}. ${it.scam ? 'МОШ' : 'ОБЫ'} → ${out.verdict} ${out.score ?? ''} (${out.engine ?? '-'}) ${it.text.slice(0, 60).replace(/\s+/g, ' ')}`)
  await sleep(PAUSE)
}

const ok = results.filter((x) => x.verdict !== 'error')
const scam = ok.filter((x) => x.scam), normal = ok.filter((x) => !x.scam)
const warned = (x) => x.verdict === 'scam' || x.verdict === 'suspicious'
const pct = (a, b) => (b ? Math.round((a / b) * 100) + '%' : '—')
const caught = scam.filter(warned).length, caughtStrict = scam.filter((x) => x.verdict === 'scam').length
const falseAlarm = normal.filter((x) => x.verdict === 'scam').length, falseWarn = normal.filter(warned).length
const correct = ok.filter((x) => (x.scam ? warned(x) : x.verdict !== 'scam')).length
const byEngine = ok.reduce((o, x) => ((o[x.engine] = (o[x.engine] || 0) + 1), o), {})
const msSorted = ok.map((x) => x.ms).sort((a, b) => a - b)
const median = msSorted.length ? msSorted[Math.floor((msSorted.length - 1) / 2)] : null

const date = new Date().toISOString().slice(0, 10)
const lines = [
  `# Тест точности Saqta — ${date}${LABEL ? ' — ' + LABEL : ''}`,
  '',
  `Набор: \`${file}\` · сообщений: **${ok.length}** (мошеннических ${scam.length}, обычных ${normal.length})${results.length > ok.length ? ` · ошибок запроса: ${results.length - ok.length}` : ''}`,
  '',
  '| Метрика | Значение |',
  '|---|---|',
  `| Мошеннические: бот предупредил («мошенники» или «подозрительно») | **${caught} из ${scam.length} (${pct(caught, scam.length)})** |`,
  `| Мошеннические: бот сказал именно «мошенники» | ${caughtStrict} из ${scam.length} (${pct(caughtStrict, scam.length)}) |`,
  `| Обычные: ложная тревога «мошенники» | **${falseAlarm} из ${normal.length} (${pct(falseAlarm, normal.length)})** |`,
  `| Обычные: хоть какое-то предупреждение | ${falseWarn} из ${normal.length} (${pct(falseWarn, normal.length)}) |`,
  `| Общая доля верных ответов | ${correct} из ${ok.length} (${pct(correct, ok.length)}) |`,
  `| Медианное время ответа | ${median ? (median / 1000).toFixed(1) + ' с' : '—'} |`,
  `| Кто отвечал | ${Object.entries(byEngine).map(([k, v]) => `${k === 'rules' ? 'только правила' : 'модель ИИ'} (${k}): ${v}`).join(', ')} |`,
  '',
  '«Верный ответ»: для мошеннического — было предупреждение; для обычного — не было вердикта «мошенники».',
  '',
  '## Промахи',
  '',
  ...(ok.filter((x) => (x.scam ? !warned(x) : x.verdict === 'scam')).map((x) => `- №${x.n} (${x.scam ? 'мошенническое' : 'обычное'}, ${x.scheme || 'схема не указана'}) → ${x.verdict} ${x.score}: «${x.text.slice(0, 140).replace(/\s+/g, ' ')}»`)),
  ...(ok.every((x) => (x.scam ? warned(x) : x.verdict !== 'scam')) ? ['Промахов нет.'] : []),
  '',
  '## Все сообщения',
  '',
  '| № | Ожидали | Вердикт | Риск | Кто ответил | Схема (бот) | Время | Текст |',
  '|---|---|---|---|---|---|---|---|',
  ...results.map((x) => `| ${x.n} | ${x.scam ? 'мошенники' : 'обычное'} | ${x.verdict} | ${x.score ?? ''} | ${x.engine ?? ''} | ${x.scheme_got ?? ''} | ${(x.ms / 1000).toFixed(1)} с | ${x.text.slice(0, 90).replace(/\s+/g, ' ').replace(/\|/g, '/')} |`)
]
const outDir = join(process.cwd(), '..', 'eval')
mkdirSync(outDir, { recursive: true })
const base = join(outDir, `report-${date}${LABEL ? '-' + LABEL.replace(/[^\p{L}\p{N}]+/gu, '-') : ''}`)
writeFileSync(base + '.md', lines.join('\n'))
writeFileSync(base + '.json', JSON.stringify(results, null, 2))
console.log(`\nПредупредили о мошенничестве: ${pct(caught, scam.length)} · ложные «мошенники»: ${pct(falseAlarm, normal.length)} · верных: ${pct(correct, ok.length)}`)
console.log('Отчёт:', base + '.md')
