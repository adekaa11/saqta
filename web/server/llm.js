// Анализ по смыслу языковой моделью (бесплатные тарифы).
// Провайдер выбирается по ключу: GEMINI_API_KEY (Google, приоритет) или GROQ_API_KEY.
// Без ключа или при ошибке возвращает null — тогда работают одни правила.
const GEMINI_KEY = process.env.GEMINI_API_KEY
const GROQ_KEY = process.env.GROQ_API_KEY
const PROVIDER = GEMINI_KEY ? 'gemini' : GROQ_KEY ? 'groq' : null
const MODEL = PROVIDER === 'gemini' ? process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite'
  : process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'
export const llmEnabled = Boolean(PROVIDER)
export const llmModel = PROVIDER ? `${PROVIDER}:${MODEL}` : null

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
Также опасно: просьба установить AnyDesk/RustDesk, назвать ИИН, CVV, срок карты, пароль, код; ссылки на незнакомые сайты; давление и спешка.

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

// Бесплатные модели Gemini бывают перегружены (503) или упираются в лимит (429) —
// тогда пробуем следующую. Первая — из GEMINI_MODEL, если задана.
// (gemini-2.5-* закрыты для новых ключей — Google сам отправляет на 3.5)
// Сначала быстрые lite (~2–3 с), полная flash думает ~10 с — только запасной вариант
const GEMINI_CHAIN = [...new Set([MODEL, 'gemini-3.5-flash-lite', 'gemini-flash-lite-latest', 'gemini-3.5-flash', 'gemini-flash-latest'])]
export let lastGeminiModel = null

async function callGemini(text, signal) {
  let lastErr
  for (const model of GEMINI_CHAIN) {
    try {
      const out = await callGeminiModel(model, text, signal)
      lastGeminiModel = model
      return out
    } catch (e) {
      lastErr = e
      if (signal.aborted || !/http (404|429|500|503)/.test(e.message)) throw e
      console.error('gemini fallback', model, e.message.slice(0, 80))
    }
  }
  throw lastErr
}

export async function listGeminiModels() {
  if (!GEMINI_KEY) return null
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': GEMINI_KEY } })
  const j = await r.json()
  return (j.models || []).filter((m) => m.supportedGenerationMethods?.includes('generateContent')).map((m) => m.name.replace('models/', ''))
}

async function callGeminiModel(model, text, signal) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    signal,
    headers: { 'x-goog-api-key': GEMINI_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: 'user', parts: [{ text: `Текст для проверки:\n"""\n${text}\n"""` }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 4000, responseMimeType: 'application/json' }
    })
  })
  if (!r.ok) throw new Error(`gemini http ${r.status}: ${(await r.text()).slice(0, 300)}`)
  const j = await r.json()
  return parseJSON(j.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join(''))
}

async function callGroq(text, signal) {
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    signal,
    headers: { Authorization: `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.1,
      max_tokens: 1000,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: `Текст для проверки:\n"""\n${text}\n"""` }]
    })
  })
  if (!r.ok) throw new Error(`groq http ${r.status}: ${(await r.text()).slice(0, 300)}`)
  const j = await r.json()
  return parseJSON(j.choices?.[0]?.message?.content)
}

export async function llmAnalyze(text, { timeoutMs = 15000 } = {}) {
  if (!PROVIDER) return null
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    return await (PROVIDER === 'gemini' ? callGemini : callGroq)(text, ctrl.signal)
  } catch (e) {
    console.error('llm failed', PROVIDER, e?.name, e?.message)
    return null
  } finally {
    clearTimeout(timer)
  }
}
