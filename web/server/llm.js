// Анализ по смыслу языковой моделью (бесплатные тарифы).
// Цепочка: Gemini (Google) → Groq (запасной, другие серверы) → null, и тогда работают одни правила.
// Каждый провайдер включается своим ключом: GEMINI_API_KEY, GROQ_API_KEY.
const GEMINI_KEY = process.env.GEMINI_API_KEY
const GROQ_KEY = process.env.GROQ_API_KEY
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite'
const GROQ_MODELS = [...new Set([process.env.GROQ_MODEL || 'openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b'])] // llama-3.3 и llama-4 Groq снял
export const llmEnabled = Boolean(GEMINI_KEY || GROQ_KEY)
export const llmModel = [GEMINI_KEY && `gemini:${MODEL}`, GROQ_KEY && `groq:${GROQ_MODELS[0]}`].filter(Boolean).join(' → ') || null

export const LLM_FLAG_TYPES = ['sms_code', 'safe_account', 'remote_access', 'authority', 'payment_request', 'personal_data', 'urgency', 'link', 'too_good', 'wrong_transfer', 'other']
export const LLM_SCHEMES = ['fake_bank', 'safe_account', 'fake_gov', 'wrong_transfer', 'relative', 'prize', 'marketplace', 'investment', 'other', 'none']

const SYSTEM = `Ты — антифрод-аналитик сервиса Saqta (Казахстан). Пожилой человек прислал текст: SMS, сообщение из мессенджера или свой пересказ телефонного звонка, на русском или казахском (возможны опечатки, разговорная речь, смесь языков). Оцени, мошенничество ли это.

Частые схемы в Казахстане:
- fake_bank: «служба безопасности» Kaspi, Halyk и др. банков, «подозрительная операция», просят SMS-код, данные карты.
- safe_account: просят перевести деньги на «безопасный/резервный счёт».
- fake_gov: «1414», eGov, ЦОН, КНБ, полиция, прокуратура, АРРФР, «на вас оформляют кредит», «участие в преступлении».
- wrong_transfer: «ошибочно перевёл/скинули деньги — верните на этот номер».
- relative: «мама, я попал в беду / в аварию, срочно нужны деньги», пишут с чужого номера.
- prize: выигрыш, розыгрыш, «раздают деньги», компенсации, соцвыплаты, пособия по ссылке.
- marketplace: OLX, Kaspi-магазин, доставка — «получите оплату / оплатите по ссылке».
- investment: лёгкий доход, инвестиции, крипта, «удалённая работа с высоким заработком».
- recovery: «вернём украденные деньги», «Интерпол / юристы / полиция помогут вернуть средства» — платные «возвраты».
- «продление SIM-карты / договора с оператором», «запись к врачу / талон / флюорография», «заказное письмо / курьер Казпочты» — когда звонящий говорит «сейчас придёт код» и просит его назвать.
- взлом аккаунта: «войдите в мой iCloud / Apple ID», «кликни / проголосуй за …», знакомый внезапно просит «скинь реквизиты / номер карты» или деньги.
- «только для подписчиков», «лёгкий заработок», незнакомый «журналист» или «организатор» с лестью — приманка, дальше выманивают код.
Также опасно: просьба установить AnyDesk/RustDesk, назвать ИИН, CVV, срок карты, пароль, код; ссылки на незнакомые или поддельные похожие сайты (egovs.cc, kzpochta.youroplata.online, cdek.y-sendz.sbs); давление и спешка.

НЕ мошенничество (очень важно, не поднимай ложную тревогу — пожилой человек перестанет доверять):
- Код, который ПРИШЁЛ человеку от сервиса (1414, eGov, Kaspi, Halyk, Aitu, e-Salyq): «Код подтверждения …», «никому не сообщайте». Сам код — норма; опасно только если кто-то ПРОСИТ его назвать или переслать.
- Предупреждения банков, МВД, операторов о мошенниках («не устанавливайте AnyDesk», «положите трубку, это мошенники») — это защита, а не обман, даже если в тексте есть слова «код», «кредит», «AnyDesk».
- Обычные уведомления банка или госсервиса без просьбы позвонить незнакомцу, перевести деньги или ввести данные на стороннем сайте (списание, ограничение от судисполнителя, «вам направлено уведомление в eGov mobile» со ссылкой на egov.kz / egovmobile.page.link).
Отличай официальные домены (egov.kz, kaspi.kz, halykbank.kz, kazpost.kz, page.link от eGov) от поддельных похожих.

Граница: ставь «безопасно» (0–39), только если это обычная переписка или уведомление, которое ничего не просит. Если НЕЗНАКОМЫЙ просит деньги, код, реквизиты, данные карты, вход в аккаунт, оплату/получение денег по ссылке или через «доставку / OLX / Казпочту», уводит разговор в WhatsApp или Telegram, вызывает «в суд / полицию» через мессенджер, обещает выплату, возврат денег или заработок — это минимум «подозрительно» (40–69), даже если просьба мягкая или текст обрезан. Если в пересказе звонка звонивший сказал «сейчас придёт код / сообщение / талон» — это мошенники (70+).

Обычная семейная или бытовая переписка без просьб о деньгах, кодах, данных или переходе по ссылке — безопасна. Не выдумывай признаков, которых в тексте нет.

Ответь ТОЛЬКО JSON-объектом:
{"risk_score": 0-100,
 "scheme": "fake_bank|safe_account|fake_gov|wrong_transfer|relative|prize|marketplace|investment|other|none",
 "red_flags": [{"quote": "дословная цитата из текста, 1–7 слов, без изменений", "type": "sms_code|safe_account|remote_access|authority|payment_request|personal_data|urgency|link|too_good|wrong_transfer|other", "explanation_ru": "почему это признак обмана, одно короткое предложение", "explanation_kk": "то же на казахском"}],
 "summary_ru": "одно короткое предложение-вывод", "summary_kk": "то же на казахском",
 "advice_ru": ["2–3 коротких совета, что делать сейчас"], "advice_kk": ["то же на казахском"]}

risk_score: 70–100 — почти наверняка мошенники; 40–69 — подозрительно; 0–39 — признаков нет. Не больше 4 улик. Пиши просто и спокойно, как для бабушки. Казахский — литературный, кириллица.`

// Ответ модели — JSON-строка; иногда оборачивается в ```json … ``` — снимаем обёртку
// и дописывает текст после — берём первый сбалансированный {...} с учётом строк
function parseJSON(s) {
  if (!s) return null
  s = String(s)
  const start = s.indexOf('{')
  if (start < 0) return null
  let depth = 0, inStr = false, esc = false
  for (let i = start; i < s.length; i++) {
    const c = s[i]
    if (inStr) {
      if (esc) esc = false
      else if (c === '\\') esc = true
      else if (c === '"') inStr = false
    } else if (c === '"') inStr = true
    else if (c === '{') depth++
    else if (c === '}' && --depth === 0) return JSON.parse(s.slice(start, i + 1))
  }
  return null
}

// Бесплатные модели Gemini бывают перегружены (503) или упираются в лимит (429) — тогда пробуем следующую.
// gemini-2.5-* закрыты для новых ключей; flash-latest быстро упирается в квоту (429).
// Если есть Groq — у Gemini короткая попытка, дальше быстрее спросить Groq, чем ждать медленную flash.
const GEMINI_ATTEMPTS = GROQ_KEY
  ? [{ model: MODEL, ms: 4000 }, { model: 'gemini-flash-lite-latest', ms: 4000 }]
  : [{ model: MODEL, ms: 5000 }, { model: 'gemini-flash-lite-latest', ms: 5000 }, { model: MODEL, ms: 5000, pause: 600 }, { model: 'gemini-3.5-flash', ms: 9000 }]
export let lastModel = null

const noThinkingCfg = new Set() // модели, которые не принимают thinkingConfig
const retryable = (e) => e.name === 'TimeoutError' || e.name === 'AbortError' || /http (400|404|429|500|502|503)/.test(e.message)

export async function tryInOrder(attempts, call, signal) {
  let lastErr
  for (const { model, ms, pause } of attempts) {
    if (pause) await new Promise((r) => setTimeout(r, pause))
    if (signal.aborted) break
    const t0 = Date.now()
    try {
      const out = await call(model, AbortSignal.any([signal, AbortSignal.timeout(ms)]))
      lastModel = model
      console.log('llm ok', model, Date.now() - t0, 'ms')
      return out
    } catch (e) {
      lastErr = e
      if (signal.aborted || !retryable(e)) throw e
      console.error('llm fallback', model, Date.now() - t0, 'ms', e.name, String(e.message).slice(0, 80))
    }
  }
  throw lastErr || new Error('aborted')
}

export async function listGroqModels() {
  if (!GROQ_KEY) return null
  const r = await fetch('https://api.groq.com/openai/v1/models', { headers: { Authorization: 'Bearer ' + GROQ_KEY } })
  const j = await r.json()
  return (j.data || []).map((m) => m.id).sort()
}

export async function listGeminiModels() {
  if (!GEMINI_KEY) return null
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': GEMINI_KEY } })
  const j = await r.json()
  return (j.models || []).filter((m) => m.supportedGenerationMethods?.includes('generateContent')).map((m) => m.name.replace('models/', ''))
}

async function callGeminiModel(model, text, signal) {
  // Для проверки сообщения долгое «рассуждение» не нужно — просим минимум, это сильно быстрее
  const thinking = !noThinkingCfg.has(model)
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    signal,
    headers: { 'x-goog-api-key': GEMINI_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: 'user', parts: [{ text: `Текст для проверки:
"""
${text}
"""` }] }],
      generationConfig: {
        temperature: 0.1, maxOutputTokens: 4000, responseMimeType: 'application/json',
        ...(thinking ? { thinkingConfig: { thinkingLevel: 'minimal' } } : {})
      }
    })
  })
  if (!r.ok) {
    const body = (await r.text()).slice(0, 300)
    if (thinking && r.status === 400 && /thinking/i.test(body)) {
      noThinkingCfg.add(model) // модель не знает этот параметр — повторяем без него
      return callGeminiModel(model, text, signal)
    }
    throw new Error(`gemini http ${r.status}: ${body}`)
  }
  const j = await r.json()
  return parseJSON(j.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join(''))
}

const noReasoningCfg = new Set()

async function callGroqModel(model, text, signal, strictJson = true) {
  // gpt-oss — «рассуждающая» модель; для проверки сообщения хватает низкого уровня, это в разы быстрее
  const lowReasoning = model.startsWith('openai/gpt-oss') && !noReasoningCfg.has(model)
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    signal,
    headers: { Authorization: `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      max_tokens: 1500,
      ...(lowReasoning ? { reasoning_effort: 'low' } : {}),
      ...(strictJson ? { response_format: { type: 'json_object' } } : {}),
      messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: `Текст для проверки:
"""
${text}
"""` }]
    })
  })
  if (!r.ok) {
    const body = (await r.text()).slice(0, 300)
    if (lowReasoning && r.status === 400 && /reasoning/i.test(body)) {
      noReasoningCfg.add(model) // модель не знает параметр — повторяем без него
      return callGroqModel(model, text, signal, strictJson)
    }
    // Строгий JSON-режим иногда «не собирается» (например, если в тексте мошенника есть фейковые JSON-команды) —
    // повторяем без него и достаём JSON из ответа сами
    if (strictJson && r.status === 400 && /json/i.test(body)) return callGroqModel(model, text, signal, false)
    throw new Error(`groq http ${r.status}: ${body}`)
  }
  const j = await r.json()
  const out = parseJSON(j.choices?.[0]?.message?.content)
  if (!out || typeof out.risk_score !== 'number') throw new Error('groq http 500: bad json')
  return out
}

// «Страховочный» параллельный запрос: если Gemini молчит дольше HEDGE_MS (перегружен),
// параллельно спрашиваем Groq и берём первый готовый ответ, проигравший запрос отменяем.
const HEDGE_MS = 1500

function hedged(gem, groq, abortGem, abortGroq) {
  return new Promise((resolve, reject) => {
    let pending = 2
    let groqStarted = false
    let settled = false
    const win = (v, who) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      ;(who === 'gemini' ? abortGroq : abortGem)()
      resolve(v)
    }
    const fail = (e) => { if (--pending === 0 && !settled) reject(e) }
    const startGroq = () => {
      if (groqStarted) return
      groqStarted = true
      groq().then((v) => (v ? win(v, 'groq') : fail(new Error('empty'))), fail)
    }
    const timer = setTimeout(startGroq, HEDGE_MS)
    gem().then(
      (v) => (v ? win(v, 'gemini') : (clearTimeout(timer), startGroq(), fail(new Error('empty')))),
      (e) => { clearTimeout(timer); startGroq(); fail(e) }
    )
  })
}

export async function llmAnalyze(text, { timeoutMs = 15000 } = {}) {
  if (!llmEnabled) return null
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    if (GEMINI_KEY && GROQ_KEY) {
      const gemCtrl = new AbortController()
      const groqCtrl = new AbortController()
      return await hedged(
        () => tryInOrder(GEMINI_ATTEMPTS, (m, sig) => callGeminiModel(m, text, sig), AbortSignal.any([ctrl.signal, gemCtrl.signal])),
        () => tryInOrder(GROQ_MODELS.map((model) => ({ model, ms: 6000 })), (m, sig) => callGroqModel(m, text, sig), AbortSignal.any([ctrl.signal, groqCtrl.signal])),
        () => gemCtrl.abort(), () => groqCtrl.abort()
      )
    }
    if (GEMINI_KEY) {
      try {
        return await tryInOrder(GEMINI_ATTEMPTS, (m, sig) => callGeminiModel(m, text, sig), ctrl.signal)
      } catch (e) {
        if (!GROQ_KEY || ctrl.signal.aborted) throw e
      }
    }
    return await tryInOrder(GROQ_MODELS.map((model) => ({ model, ms: 6000 })), (m, sig) => callGroqModel(m, text, sig), ctrl.signal)
  } catch (e) {
    console.error('llm failed', e?.name, e?.message)
    return null
  } finally {
    clearTimeout(timer)
  }
}
