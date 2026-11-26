// Telegram-бот Saqta: тот же движок, что и сайт. Webhook: POST /api/telegram.
// Роли: «ата-ана» (присылает сообщения на проверку, жмёт SOS) и «бала» (получает тревоги).
// Семью создаёт сын/дочь и отправляет родителю ссылку-приглашение t.me/<бот>?start=join_<id>.
import { createHash } from 'node:crypto'
import { makeCheckAlert, makeSosAlert } from '../src/engine.js'
import { analyze } from './analyze.js'
import { transcribe, readImage } from './media.js'
import * as db from './store.js'

const TOKEN = process.env.TELEGRAM_BOT_TOKEN
// Секрет вебхука: Telegram шлёт его в заголовке каждого апдейта. Выводим из токена, чтобы хватало одной переменной.
const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || (TOKEN ? createHash('sha256').update('saqta:' + TOKEN).digest('hex').slice(0, 48) : null)
const HOST = process.env.SITE_HOST || process.env.VERCEL_PROJECT_PRODUCTION_URL || 'saqta-delta.vercel.app'
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
// receivedAt — когда пришло исходное сообщение: total_ms = «время до тревоги» целиком (распознавание + анализ + доставка)
export async function raiseAlert(fid, alert, receivedAt = null) {
  const started = Date.now()
  let delivered = 0
  if (TOKEN) {
    const watchers = await db.sMembers(watchersKey(fid))
    const text = alert.type === 'sos'
      ? `<b>SOS · ${esc(alert.member_name)}</b>\nҚазір хабарласыңыз. / Срочно позвоните.${alert.text_preview && alert.text_preview !== 'SOS' ? `\n\n${esc(alert.text_preview)}` : ''}`
      : `<b>ДАБЫЛ · ${esc(alert.member_name)}</b>\n${VERDICT[alert.verdict].kk} ${alert.risk_score}/100 — ${esc(alert.scheme?.title_kk)}\n\n«${esc(alert.text_preview)}»` +
        (alert.reasons?.length
          ? `\n\n<b>${alert.lang === 'kk' ? 'Неге алаяқтық' : 'Почему бот так решил'}:</b>\n` +
            alert.reasons.map((r, i) => `${NUM[i]} «${esc(r.text)}» — ${esc(alert.lang === 'kk' ? r.kk || r.ru : r.ru)}`).join('\n')
          : '') +
        `\n\nҚазір қоңырау шалыңыз, ешкімге ақша аудармасын. / Позвоните сейчас, пока не перевели деньги.`
    const markup = { inline_keyboard: [[{ text: 'Көрдім / Увидел', callback_data: `seen:${fid}:${alert.id}` }]] }
    const results = await Promise.all(watchers.map((c) => send(c, text, { reply_markup: markup }).catch(() => null)))
    delivered = results.filter((r) => r?.ok).length
  }
  alert.tg_delivered = delivered
  alert.tg_delivery_ms = delivered ? Date.now() - started : null
  await db.pushAlert(fid, alert)
  await db.incr('saqta:stats:alerts')
  await db.logEvent({
    type: 'alert', kind: alert.type, demo: fid === db.DEMO_FAMILY.family_id, delivered,
    delivery_ms: alert.tg_delivery_ms, total_ms: receivedAt && delivered ? Date.now() - receivedAt : null
  })
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

const PRIVACY = 'Хабарламаларды Saqta жасанды интеллектісі тексереді. Өз құпиясөзіңізді, картаңыздың нөмірін және өзіңізге келген кодтарды жібермеңіз.\nСообщения проверяет искусственный интеллект Saqta. Не присылайте свои пароли, номер карты и пришедшие вам коды.'

const HELP = 'Күдікті хабарламаны осында жіберіңіз — мәтінін, скриншотын немесе «Переслать». Қоңырау болса — дауыстық хабармен айтып беріңіз.\n' +
  'Пришлите сюда подозрительное сообщение — текстом, скриншотом или «Переслать». Был звонок — расскажите голосовым сообщением.'

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
    await db.logEvent({ type: 'elder_joined' })
    for (const w of await db.sMembers(watchersKey(join[1]))) {
      await send(w, `${esc(name)} Saqta-ға қосылды. Енді қауіп болса, сізге хабар келеді.\n${esc(name)} подключилась — при опасности вы получите тревогу.`).catch(() => null)
    }
    return send(chat, `Сәлеметсіз бе, ${esc(name)}! Сіздің отбасыңыз қосылды.\nЗдравствуйте! Ваша семья подключена.\n\n${HELP}\n\n${PRIVACY}\n\nҚауіп төнсе — төмендегі SOS батырмасын басыңыз.\nЕсли страшно — нажмите SOS внизу.`, { reply_markup: elderKeyboard })
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
    return send(chat, `${HELP}\n\n${PRIVACY}\n\nБалаңыз дабыл алуы үшін: ол осы ботты ашып, «Мен баламын» батырмасын бассын да, сізге сілтеме жіберсін.\nЧтобы сын или дочь получали тревоги: пусть откроет этого бота, нажмёт «Я сын или дочь» и пришлёт вам ссылку.`, { reply_markup: elderKeyboard })
  }

  if (data === 'role:watcher') {
    const fid = 'f' + Math.random().toString(36).slice(2, 8)
    await db.setJSON(db.familyKey(fid), { family_id: fid, created_at: new Date().toISOString(), created_by: chat })
    await db.sAdd(watchersKey(fid), chat)
    await db.setJSON(userKey(chat), { role: 'watcher', fid, name })
    await db.incr('saqta:stats:families')
    await db.logEvent({ type: 'family_created' })
    const link = `https://t.me/${await botUsername()}?start=join_${fid}`
    await send(chat, 'Отбасы құрылды. Келесі хабарламаны анаңызға/әкеңізге жіберіңіз — ол сілтемені басса, болды.\nСемья создана. Перешлите следующее сообщение маме или папе — пусть нажмёт ссылку.')
    return send(chat, `Апа, мына сілтемені басыңыз — күдікті қоңырау не хабарлама болса, мен бірден көремін:\nНажмите на ссылку — если будет подозрительный звонок или сообщение, я сразу узнаю:\n${link}`)
  }

  if (data === 'sos') return sendSos(chat, await db.getJSON(userKey(chat)))

  const seen = data.match(/^seen:([\w-]+):([\w-]+)$/)
  if (seen) {
    await markAlert(seen[1], seen[2], 'seen')
    return tg('editMessageReplyMarkup', { chat_id: chat, message_id: q.message.message_id, reply_markup: { inline_keyboard: [[{ text: 'Көрдім ✓', callback_data: 'noop' }]] } })
  }
}

async function onMessage(msg) {
  const receivedAt = Date.now()
  const chat = msg.chat.id
  const text = (msg.text || msg.caption || '').trim()

  if (text.startsWith('/start')) return onStart(msg, text.split(/\s+/)[1])
  if (text === '/help') return send(chat, HELP)

  const user = await db.getJSON(userKey(chat))

  if (text === SOS_LABEL || text === '/sos') return sendSos(chat, user)

  // Голосовое или скриншот → текст → тот же анализ
  const voice = msg.voice || msg.audio || msg.video_note
  const imageDoc = msg.document?.mime_type?.startsWith('image/') ? msg.document : null
  const photo = msg.photo?.length ? msg.photo[msg.photo.length - 1] : imageDoc
  if (voice || photo) {
    const media = voice || photo
    if (voice && (voice.duration || 0) > 180) return send(chat, 'Хабар тым ұзын — 3 минутқа дейін жіберіңіз.\nСлишком длинное сообщение — пришлите до 3 минут.')
    if ((media.file_size || 0) > 15e6) return send(chat, 'Файл тым үлкен. / Файл слишком большой.')
    tg('sendChatAction', { chat_id: chat, action: 'typing' }).catch(() => null)
    const wait = await send(chat, voice ? 'Тыңдап жатырмын… / Слушаю…' : 'Скриншотты оқып жатырмын… / Читаю скриншот…').catch(() => null)
    const mime = msg.voice ? 'audio/ogg' : msg.video_note ? 'video/mp4' : msg.audio ? msg.audio.mime_type || 'audio/mpeg' : imageDoc?.mime_type || 'image/jpeg'
    const buf = await downloadFile(media.file_id)
    const got = buf ? await (voice ? transcribe(buf, mime) : readImage(buf, mime)) : null
    if (got === null) return replace(chat, wait, 'Қазір тани алмадым — бір минуттан соң қайталаңыз немесе мәтінмен жазыңыз.\nНе получилось распознать — попробуйте через минуту или пришлите текстом.')
    const combined = [got, text].filter(Boolean).join('\n').trim() // подпись к фото тоже проверяем
    if (!combined) return replace(chat, wait, voice ? 'Сөз естілмеді — қайта жазып көріңіз.\nНе расслышал слов — запишите ещё раз.' : 'Скриншоттан хабарлама мәтінін таппадым.\nНа скриншоте не нашёл текста сообщения.')
    return checkAndReply(chat, user, combined.slice(0, 4000), wait, voice ? 'Естігенім / Я услышал' : 'Скриншоттағы мәтін / Текст со скриншота', receivedAt, voice ? 'voice' : 'screenshot')
  }
  if (!text) return send(chat, HELP)
  if (text.length > 4000) return send(chat, 'Мәтін тым ұзын. / Слишком длинный текст.')

  // Сразу показываем, что бот работает: «печатает…» + сообщение, которое потом заменим вердиктом
  tg('sendChatAction', { chat_id: chat, action: 'typing' }).catch(() => null)
  const wait = await send(chat, 'Тексеріп жатырмын… / Проверяю…').catch(() => null)
  return checkAndReply(chat, user, text, wait, null, receivedAt, 'text')
}

async function downloadFile(file_id) {
  try {
    const f = await tg('getFile', { file_id })
    if (!f.ok) return null
    const r = await fetch(`https://api.telegram.org/file/bot${TOKEN}/${f.result.file_path}`)
    return r.ok ? Buffer.from(await r.arrayBuffer()) : null
  } catch (e) {
    console.error('download failed', e?.message)
    return null
  }
}

// Заменяет «Проверяю…» на итоговый текст (или шлёт новое сообщение, если заменить не вышло)
async function replace(chat, wait, text, extra = {}) {
  const msgId = wait?.ok && wait.result?.message_id
  if (msgId) {
    const ed = await tg('editMessageText', { chat_id: chat, message_id: msgId, text, parse_mode: 'HTML', disable_web_page_preview: true, ...extra }).catch(() => null)
    if (ed?.ok) return ed
  }
  return send(chat, text, extra)
}

async function checkAndReply(chat, user, text, wait, heardLabel, receivedAt = Date.now(), input = 'text') {
  const t0 = Date.now()
  const r = await analyze(text)
  r.elapsed_ms = Date.now() - t0
  await db.logEvent({ type: 'check', src: 'bot', input, verdict: r.verdict, score: r.risk_score, engine: r.engine, ms: Date.now() - receivedAt, in_family: Boolean(user?.fid) })
  await db.incr('saqta:stats:checks')
  await db.incr(`saqta:stats:checks:${r.verdict}`)
  let alerted = false
  if (r.verdict === 'scam' && user?.role === 'elder' && user.fid) {
    const alert = await raiseAlert(user.fid, makeCheckAlert(r, text, user.name), receivedAt)
    alerted = alert.tg_delivered > 0
  }
  // При риске SOS — прямо под ответом: клавиатуру внизу Telegram часто прячет
  const sosButton = user?.role === 'elder' && user.fid && r.verdict !== 'safe' ? { inline_keyboard: [[{ text: SOS_LABEL, callback_data: 'sos' }]] } : undefined
  let body = verdictMessage(r, alerted)
  // Показываем, что бот услышал/прочитал — чтобы человек видел, что проверено именно его сообщение
  if (heardLabel) body = `<i>${heardLabel}:</i>\n«${esc(text.length > 700 ? text.slice(0, 700) + '…' : text)}»\n\n${body}`
  return replace(chat, wait, body, sosButton ? { reply_markup: sosButton } : {})
}

async function sendSos(chat, user) {
  if (!user?.fid || user.role !== 'elder') return send(chat, 'SOS жіберу үшін балаңыздан сілтеме сұраңыз.\nЧтобы SOS дошёл до семьи, попросите у сына или дочери ссылку-приглашение.')
  const alert = await raiseAlert(user.fid, makeSosAlert(user.name))
  return send(chat, alert.tg_delivered ? 'Балаңызға хабар жіберілді. Ешкімге ақша аудармаңыз, код айтпаңыз.\nСемья получила сигнал. Ничего не переводите и не называйте коды.' : 'Отбасыңыздан әлі ешкім қосылмаған. / В семье пока никто не подписан на тревоги.', { reply_markup: elderKeyboard })
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

// Один раз после деплоя: GET /api/telegram/setup. Безопасно вызывать повторно:
// вебхук всегда ставится только на прод-домен Saqta, адрес из запроса не используется.
export async function setupWebhook() {
  if (!TOKEN) return { status: 503, body: { error: { code: 'BOT_DISABLED', message: 'TELEGRAM_BOT_TOKEN не задан' } } }
  const hook = await tg('setWebhook', { url: `https://${HOST}/api/telegram`, secret_token: SECRET, allowed_updates: ['message', 'callback_query'] })
  await tg('setMyCommands', { commands: [{ command: 'start', description: 'Бастау / Начать' }, { command: 'sos', description: 'SOS — отбасына хабар / сигнал семье' }, { command: 'help', description: 'Көмек / Помощь' }] })
  return { status: 200, body: { webhook: hook, bot: await botUsername() } }
}
