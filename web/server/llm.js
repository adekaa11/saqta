// Анализ по смыслу через Groq (бесплатный тариф, OpenAI-совместимый API).
// Без ключа или при ошибке возвращает null — тогда работают одни правила.
const KEY = process.env.GROQ_API_KEY
const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'
export const llmEnabled = Boolean(KEY)
export const llmModel = MODEL

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

export async function llmAnalyze(text, { timeoutMs = 8000 } = {}) {
  if (!KEY) return null
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.1,
        max_tokens: 1000,
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: `Текст для проверки:\n"""\n${text}\n"""` }]
      })
    })
    if (!r.ok) {
      console.error('groq http', r.status, (await r.text()).slice(0, 300))
      return null
    }
    const j = await r.json()
    return JSON.parse(j.choices?.[0]?.message?.content || 'null')
  } catch (e) {
    console.error('groq failed', e?.name, e?.message)
    return null
  } finally {
    clearTimeout(timer)
  }
}
