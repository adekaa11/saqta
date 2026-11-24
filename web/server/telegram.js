// Telegram-бот Saqta: тот же движок, что и сайт. Webhook: POST /api/telegram.
// Роли: «ата-ана» (присылает сообщения на проверку, жмёт SOS) и «бала» (получает тревоги).
// Семью создаёт сын/дочь и отправляет родителю ссылку-приглашение t.me/<бот>?start=join_<id>.
import { analyzeText, makeCheckAlert, makeSosAlert } from '../src/engine.js'
import * as db from './store.js'

const TOKEN = process.env.TELEGRAM_BOT_TOKEN
const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET
export const telegramEnabled = Boolean(TOKEN)

async function tg(method, body) {
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  return r.json()
}

export async function botUsername() {
  if (!TOKEN) return null
  if (globalThis.__saqtaBotName) return globalThis.__saqtaBotName
  const j = await tg('getMe', {})
  return (globalThis.__saqtaBotName = j.ok ? j.result.username : null)
}

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const send = (chat_id, text, extra = {}) => tg('sendMessage', { chat_id, text, parse_mode: 'HTML', disable_web_page_preview: true, ...extra })

const userKey = (chatId) => `saqta:tg:user:${chatId}`
const watchersKey = (fid) => `saqta:family:${fid}:watchers`
const NUM = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨']
const SOS_LABEL = 'SOS — балама хабар беру'

const VERDICT = {
  scam: { kk: 'АЛАЯҚТАР', ru: 'МОШЕННИКИ' },
  suspicious: { kk: 'КҮДІКТІ', ru: 'ПОДОЗРИТЕЛЬНО' },
  safe: { kk: 'ҚАУІПСІЗ', ru: 'БЕЗОПАСНО' }
}

const elderKeyboard = { keyboard: [[{ text: SOS_LABEL }]], resize_keyboard: true, is_persistent: true }

// ---------- тревоги семье (общие для сайта и бота) ----------
// Шлёт тревогу всем «бала» семьи и сохраняет её в ленту (её видит и страница #/family на сайте).
// tg_delivery_ms — время от создания тревоги до ответа Telegram API (метрика «время до тревоги»).
export async function raiseAlert(fid, alert) {
  const started = Date.now()
  let delivered = 0
  if (TOKEN) {
    const watchers = await db.sMembers(watchersKey(fid))
    const text = alert.type === 'sos'
      ? `<b>SOS · ${esc(alert.member_name)}</b>\nҚазір хабарласыңыз. / Срочно позвоните.${alert.text_preview && alert.text_preview !== 'SOS' ? `\n\n${esc(alert.text_preview)}` : ''}`
      : `<b>ДАБЫЛ · ${esc(alert.member_name)}</b>\n${VERDICT[alert.verdict].kk} ${alert.risk_score}/100 — ${esc(alert.scheme?.title_kk)}\n\n«${esc(alert.text_preview)}»\n\nҚазір қоңырау шалыңыз, ешкімге ақша аудармасын. / Позвоните сейчас, пока не перевели деньги.`
    const markup = { inline_keyboard: [[{ text: 'Көрдім / Увидел', callback_data: `seen:${fid}:${alert.id}` }]] }
    const results = await Promise.all(watchers.map((c) => send(c, text, { reply_markup: markup }).catch(() => null)))
    delivered = results.filter((r) => r?.ok).length
  }
  alert.tg_delivered = delivered
  alert.tg_delivery_ms = delivered ? Date.now() - started : null
  await db.pushAlert(fid, alert)
  await db.incr('saqta:stats:alerts')
  return alert
}

async function markAlert(fid, id, status) {
  const list = await db.getAlerts(fid)
  const a = list.find((x) => x.id === id)
  if (!a) return null
  a.status = status
  a.seen_at = new Date().toISOString()
  await db.setAlerts(fid, list)
  return a
}

// ---------- ответ на проверку ----------
function verdictMessage(r, alerted) {
  const kk = r.detected_lang === 'kk'
  const L = (k, ru) => (kk ? k : ru)
  const lines = [`<b>${L(VERDICT[r.verdict].kk, VERDICT[r.verdict].ru)} · ${r.risk_score}/100</b>`, esc(L(r.summary_kk, r.summary_ru))]
  if (r.scheme?.code !== 'none') lines.push(`${L('Схема', 'Схема')}: ${esc(L(r.scheme.title_kk, r.scheme.title_ru))}`)
  if (r.red_flags.length) {
    lines.push('', `<b>${L('Неге алаяқтық', 'Почему это обман')}:</b>`)
    r.red_flags.forEach((f, i) => lines.push(`${NUM[i] || '•'} «${esc(f.text)}» — ${esc(L(f.explanation_kk, f.explanation_ru))}`))
  }
  lines.push('', `<b>${L('Не істеу керек', 'Что делать')}:</b>`)
  L(r.advice_kk, r.advice_ru).forEach((a) => lines.push(`• ${esc(a)}`))
  if (alerted) lines.push('', `<b>${L('Балаңызға дабыл жіберілді.', 'Тревога отправлена вашему ребёнку.')}</b>`)
  return lines.join('\n')
}

const HELP = 'Күдікті хабарламаны осында жіберіңіз (көшіріп немесе «Переслать»). Мен 3 секундта тексеремін.\n' +
  'Пришлите или перешлите сюда подозрительное сообщение — проверю за 3 секунды.\n\n' +
  'Қоңырауды өз сөзіңізбен жазыңыз: телефон пернетақтасындағы микрофонды басып, айтып беріңіз.\n' +
  'Звонок можно пересказать: нажмите микрофон на клавиатуре телефона и расскажите.'

// ---------- обработка апдейтов ----------
async function onStart(msg, payload) {
  const chat = msg.chat.id
  const name = msg.from?.first_name || 'Апа'

  const join = payload?.match(/^join_([\w-]+)$/)
  const watch = payload?.match(/^watch_([\w-]+)$/)

  if (join) {
    const fam = await db.getFamily(join[1])
    if (!fam) return send(chat, 'Сілтеме ескірген. / Ссылка недействительна — попросите новую.')
    await db.setJSON(userKey(chat), { role: 'elder', fid: join[1], name })
    await db.incr('saqta:stats:elders')
    for (const w of await db.sMembers(watchersKey(join[1]))) {
      await send(w, `${esc(name)} Saqta-ға қосылды. Енді қауіп болса, сізге хабар келеді.\n${esc(name)} подключилась — при опасности вы получите тревогу.`).catch(() => null)
    }
    return send(chat, `Сәлеметсіз бе, ${esc(name)}! Сіздің отбасыңыз қосылды.\nЗдравствуйте! Ваша семья подключена.\n\n${HELP}\n\nҚауіп төнсе — төмендегі SOS батырмасын басыңыз.\nЕсли страшно — нажмите SOS внизу.`, { reply_markup: elderKeyboard })
  }

  if (watch) {
    const fam = await db.getFamily(watch[1])
    if (!fam) return send(chat, 'Сілтеме ескірген. / Ссылка недействительна.')
    await db.sAdd(watchersKey(watch[1]), chat)
    await db.setJSON(userKey(chat), { role: 'watcher', fid: watch[1], name })
    return send(chat, 'Дайын. Енді отбасыңыздағы тексеру «алаяқтар» деп шықса немесе SOS басылса, хабар осында келеді.\nГотово. Тревоги семьи (мошенники или SOS) будут приходить сюда.')
  }

  return send(chat,
    `<b>Saqta</b> — алаяқтардан отбасылық қорған. / Семейный щит от мошенников.\n\nКімсіз? / Кто вы?`,
    { reply_markup: { inline_keyboard: [
      [{ text: 'Мен тексеремін (ата-ана) / Я проверяю сообщения', callback_data: 'role:elder' }],
      [{ text: 'Мен баламын — дабыл аламын / Я сын или дочь', callback_data: 'role:watcher' }]
    ] } }
  )
}

async function onCallback(q) {
  const chat = q.message?.chat?.id
  const data = q.data || ''
  const name = q.from?.first_name || ''
  await tg('answerCallbackQuery', { callback_query_id: q.id })

  if (data === 'role:elder') {
    const u = await db.getJSON(userKey(chat))
    if (!u) await db.setJSON(userKey(chat), { role: 'elder', fid: null, name })
    return send(chat, `${HELP}\n\nБалаңыз дабыл алуы үшін: ол осы ботты ашып, «Мен баламын» батырмасын бассын да, сізге сілтеме жіберсін.\nЧтобы сын или дочь получали тревоги: пусть откроет этого бота, нажмёт «Я сын или дочь» и пришлёт вам ссылку.`, { reply_markup: elderKeyboard })
  }

  if (data === 'role:watcher') {
    const fid = 'f' + Math.random().toString(36).slice(2, 8)
    await db.setJSON(db.familyKey(fid), { family_id: fid, created_at: new Date().toISOString(), created_by: chat })
    await db.sAdd(watchersKey(fid), chat)
    await db.setJSON(userKey(chat), { role: 'watcher', fid, name })
    await db.incr('saqta:stats:families')
    const link = `https://t.me/${await botUsername()}?start=join_${fid}`
    await send(chat, 'Отбасы құрылды. Келесі хабарламаны анаңызға/әкеңізге жіберіңіз — ол сілтемені басса, болды.\nСемья создана. Перешлите следующее сообщение маме или папе — пусть нажмёт ссылку.')
    return send(chat, `Апа, мына сілтемені басыңыз — күдікті қоңырау не хабарлама болса, мен бірден көремін:\nНажмите на ссылку — если будет подозрительный звонок или сообщение, я сразу узнаю:\n${link}`)
  }

  const seen = data.match(/^seen:([\w-]+):([\w-]+)$/)
  if (seen) {
    await markAlert(seen[1], seen[2], 'seen')
    return tg('editMessageReplyMarkup', { chat_id: chat, message_id: q.message.message_id, reply_markup: { inline_keyboard: [[{ text: 'Көрдім ✓', callback_data: 'noop' }]] } })
  }
}

async function onMessage(msg) {
  const chat = msg.chat.id
  const text = (msg.text || msg.caption || '').trim()

  if (text.startsWith('/start')) return onStart(msg, text.split(/\s+/)[1])
  if (text === '/help') return send(chat, HELP)

  const user = await db.getJSON(userKey(chat))

  if (text === SOS_LABEL || text === '/sos') {
    if (!user?.fid || user.role !== 'elder') return send(chat, 'SOS жіберу үшін балаңыздан сілтеме сұраңыз.\nЧтобы SOS дошёл до семьи, попросите у сына или дочери ссылку-приглашение.')
    const alert = await raiseAlert(user.fid, makeSosAlert(user.name))
    return send(chat, alert.tg_delivered ? 'Балаңызға хабар жіберілді. Ешкімге ақша аудармаңыз, код айтпаңыз.\nСемья получила сигнал. Ничего не переводите и не называйте коды.' : 'Отбасыңыздан әлі ешкім қосылмаған. / В семье пока никто не подписан на тревоги.')
  }

  if (msg.voice || msg.audio || msg.video_note) {
    return send(chat, 'Дауыстық хабарды әзірге тыңдай алмаймын. Пернетақтадағы микрофонды басып, мәтінмен жіберіңіз.\nГолосовые пока не распознаю. Нажмите микрофон на клавиатуре телефона — он сам превратит речь в текст — и отправьте.')
  }
  if (msg.photo && !text) {
    return send(chat, 'Скриншотты әзірге оқи алмаймын — мәтінін көшіріп жіберіңіз.\nСкриншоты пока не читаю — скопируйте текст сообщения и пришлите.')
  }
  if (!text) return send(chat, HELP)
  if (text.length > 4000) return send(chat, 'Мәтін тым ұзын. / Слишком длинный текст.')

  const r = analyzeText(text)
  await db.incr('saqta:stats:checks')
  await db.incr(`saqta:stats:checks:${r.verdict}`)
  let alerted = false
  if (r.verdict === 'scam' && user?.role === 'elder' && user.fid) {
    const alert = await raiseAlert(user.fid, makeCheckAlert(r, text, user.name))
    alerted = alert.tg_delivered > 0
  }
  return send(chat, verdictMessage(r, alerted), user?.role === 'elder' ? { reply_markup: elderKeyboard } : {})
}

export async function handleTelegram(req, body) {
  if (!TOKEN) return { status: 503, body: { error: { code: 'BOT_DISABLED', message: 'TELEGRAM_BOT_TOKEN не задан' } } }
  if (SECRET && req.headers['x-telegram-bot-api-secret-token'] !== SECRET) return { status: 401, body: { error: { code: 'BAD_SECRET', message: 'Неверный секрет' } } }
  try {
    if (body.message) await onMessage(body.message)
    else if (body.callback_query) await onCallback(body.callback_query)
  } catch (e) {
    console.error('telegram update failed', e)
  }
  return { status: 200, body: { ok: true } } // Telegram всегда получает 200, иначе будет повторять апдейт
}

// Один раз после деплоя: GET /api/telegram/setup?secret=<TELEGRAM_WEBHOOK_SECRET>
export async function setupWebhook(host, secret) {
  if (!TOKEN) return { status: 503, body: { error: { code: 'BOT_DISABLED', message: 'TELEGRAM_BOT_TOKEN не задан' } } }
  if (!SECRET || secret !== SECRET) return { status: 401, body: { error: { code: 'BAD_SECRET', message: 'Неверный секрет' } } }
  const hook = await tg('setWebhook', { url: `https://${host}/api/telegram`, secret_token: SECRET, allowed_updates: ['message', 'callback_query'] })
  await tg('setMyCommands', { commands: [{ command: 'start', description: 'Бастау / Начать' }, { command: 'sos', description: 'SOS — отбасына хабар / сигнал семье' }, { command: 'help', description: 'Көмек / Помощь' }] })
  return { status: 200, body: { webhook: hook, bot: await botUsername() } }
}
