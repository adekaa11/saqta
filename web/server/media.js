// Голос → текст и скриншот → текст. Дальше текст идёт в обычный анализ (analyze.js).
// Gemini слушает аудио и читает картинки сам; если перегружен — Groq (Whisper / модель с картинками).
import { tryInOrder } from './llm.js'

const GEMINI_KEY = process.env.GEMINI_API_KEY
const GROQ_KEY = process.env.GROQ_API_KEY
const LITE = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite'
const GEMINI_MEDIA = [
  { model: LITE, ms: 8000 },
  { model: 'gemini-flash-lite-latest', ms: 7000 },
  { model: 'gemini-3.5-flash', ms: 12000 }
]

const TRANSCRIBE = 'Это голосовое сообщение пожилого человека из Казахстана: он пересказывает звонок или читает сообщение (казахский, русский или смесь). Расшифруй речь дословно на языке оригинала, без комментариев, пояснений и кавычек. Если речи не слышно — ответь пустой строкой.'
const OCR = 'Это скриншот переписки, SMS или письма. Выпиши дословно текст сообщений на языке оригинала: без времени, статусов, имён кнопок и элементов интерфейса. Каждое сообщение — с новой строки. Без комментариев. Если текста сообщений нет — ответь пустой строкой.'

const clean = (s) => String(s || '').replace(/^```\w*\s*|\s*```$/g, '').replace(/^["«]|["»]$/g, '').trim()

const noThinkingCfg = new Set()

async function geminiMedia(model, prompt, buf, mime, signal) {
  // Расшифровке и чтению текста «рассуждение» не нужно — без него в разы быстрее
  const thinking = !noThinkingCfg.has(model)
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    signal,
    headers: { 'x-goog-api-key': GEMINI_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }, { inline_data: { mime_type: mime, data: buf.toString('base64') } }] }],
      generationConfig: { temperature: 0, maxOutputTokens: 3000, ...(thinking ? { thinkingConfig: { thinkingLevel: 'minimal' } } : {}) }
    })
  })
  if (!r.ok) {
    const body = (await r.text()).slice(0, 300)
    if (thinking && r.status === 400 && /thinking/i.test(body)) {
      noThinkingCfg.add(model)
      return geminiMedia(model, prompt, buf, mime, signal)
    }
    throw new Error(`gemini http ${r.status}: ${body}`)
  }
  const j = await r.json()
  return clean(j.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join(''))
}

async function groqWhisper(model, buf, mime, signal) {
  const form = new FormData()
  form.append('file', new Blob([buf], { type: mime }), mime.includes('ogg') ? 'voice.ogg' : 'voice.mp3')
  form.append('model', model)
  form.append('temperature', '0')
  const r = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST', signal, headers: { Authorization: `Bearer ${GROQ_KEY}` }, body: form
  })
  if (!r.ok) throw new Error(`groq http ${r.status}: ${(await r.text()).slice(0, 300)}`)
  return clean((await r.json()).text)
}

async function groqVision(model, buf, mime, signal) {
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    signal,
    headers: { Authorization: `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model, temperature: 0, max_tokens: 2000,
      messages: [{ role: 'user', content: [{ type: 'text', text: OCR }, { type: 'image_url', image_url: { url: `data:${mime};base64,${buf.toString('base64')}` } }] }]
    })
  })
  if (!r.ok) throw new Error(`groq http ${r.status}: ${(await r.text()).slice(0, 300)}`)
  return clean((await r.json()).choices?.[0]?.message?.content)
}

async function run(geminiPrompt, groqCall, groqModels, buf, mime) {
  const signal = AbortSignal.timeout(28000)
  if (GEMINI_KEY) {
    try {
      return await tryInOrder(GEMINI_MEDIA, (m, sig) => geminiMedia(m, geminiPrompt, buf, mime, sig), signal)
    } catch (e) {
      if (!GROQ_KEY || signal.aborted) throw e
    }
  }
  if (!GROQ_KEY) throw new Error('no media provider')
  return tryInOrder(groqModels.map((model) => ({ model, ms: 9000 })), (m, sig) => groqCall(m, buf, mime, sig), signal)
}

export const mediaEnabled = Boolean(GEMINI_KEY || GROQ_KEY)

// null — не удалось распознать (сеть/лимиты); '' — распознано, но речи/текста нет
export async function transcribe(buf, mime = 'audio/ogg') {
  try { return await run(TRANSCRIBE, groqWhisper, ['whisper-large-v3-turbo', 'whisper-large-v3'], buf, mime) } catch (e) {
    console.error('transcribe failed', e?.message)
    return null
  }
}

export async function readImage(buf, mime = 'image/jpeg') {
  try { return await run(OCR, groqVision, ['qwen/qwen3.8-27b'] /* llama-4 vision у Groq больше нет */, buf, mime) } catch (e) {
    console.error('ocr failed', e?.message)
    return null
  }
}
