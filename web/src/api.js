import { analyzeText, makeCheckAlert, makeSosAlert, seedAlerts, familyInfo, mocks } from './engine.js'

// VITE_USE_MOCK=false — реальный API. VITE_API_URL пустой = тот же домен (функции Vercel /api).
export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'
export const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')
export const FAMILY_ID = 'fam_demo'
export const MEMBER_NAME = 'Гүлнар апа'

export class ApiError extends Error {
  constructor(code, message, status) {
    super(message)
    this.code = code
    this.status = status
  }
}

async function http(method, path, body) {
  let res
  try {
    res = await fetch(`${API_URL}/api${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    })
  } catch {
    throw new ApiError('NETWORK', 'Нет связи с сервером', 0)
  }
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new ApiError(data?.error?.code || 'HTTP_' + res.status, data?.error?.message || 'Ошибка сервера', res.status)
  }
  return data
}

/* ---------------- MOCK ---------------- */
// Алерты в localStorage: две вкладки одного браузера видят друг друга.
const STORE_KEY = 'saqta_mock_alerts_v1'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

function loadAlerts() {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return seedAlerts()
}
function saveAlerts(list) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(list)) } catch {}
}

async function mockAnalyze({ text, family_id, member_name }) {
  await wait(1100)
  const t = (text || '').trim()
  if (!t) throw new ApiError('EMPTY_TEXT', 'Текст сообщения пустой', 400)
  if (t.length > 4000) throw new ApiError('TEXT_TOO_LONG', 'Слишком длинный текст', 413)
  const res = analyzeText(t)
  res.family_alert_sent = false
  if (res.verdict === 'scam' && family_id) {
    const list = loadAlerts()
    list.unshift(makeCheckAlert(res, t, member_name || MEMBER_NAME))
    saveAlerts(list)
    res.family_alert_sent = true
  }
  return res
}

// Реальный API, а при обрыве сети — моки, чтобы демо не падало
async function withFallback(real, mock) {
  if (USE_MOCK) return mock()
  try {
    return await real()
  } catch (e) {
    if (e.code === 'NETWORK' || e.status >= 500) return mock()
    throw e
  }
}

/* ---------------- PUBLIC API ---------------- */
export function analyze(payload) {
  return withFallback(
    async () => {
      const [r] = await Promise.all([http('POST', '/analyze', payload), wait(900)]) // пауза, чтобы «анализ» читался на видео
      return r
    },
    () => mockAnalyze(payload)
  )
}

export function getAlerts(familyId = FAMILY_ID) {
  return withFallback(
    () => http('GET', `/families/${familyId}/alerts`),
    async () => ({ ...familyInfo(), alerts: loadAlerts() })
  )
}

export function sendSos({ member_name = MEMBER_NAME, note } = {}, familyId = FAMILY_ID) {
  return withFallback(
    () => http('POST', `/families/${familyId}/sos`, { member_name, note }),
    async () => {
      const alert = makeSosAlert(member_name, note)
      const list = loadAlerts()
      list.unshift(alert)
      saveAlerts(list)
      return alert
    }
  )
}

export function patchAlert(id, status) {
  return withFallback(
    () => http('PATCH', `/alerts/${id}`, { status }),
    async () => {
      const list = loadAlerts()
      const a = list.find((x) => x.id === id)
      if (!a) throw new ApiError('ALERT_NOT_FOUND', 'Алерт не найден', 404)
      a.status = status
      saveAlerts(list)
      return a
    }
  )
}

export async function resetDemo(familyId = FAMILY_ID) {
  try { localStorage.removeItem(STORE_KEY) } catch {}
  if (!USE_MOCK) {
    try { await http('POST', `/families/${familyId}/reset`) } catch {}
  }
}

export const demoMessages = mocks.demo_messages

// Скриншот → текст на сервере. Картинку сжимаем в браузере, чтобы не гнать мегабайты.
export async function ocrImage(file) {
  if (USE_MOCK) throw new ApiError('OCR_OFFLINE', 'Скриншоты работают только с сервером', 0)
  const { data, mime } = await shrinkImage(file)
  const r = await http('POST', '/ocr', { image: data, mime })
  return r.text || ''
}

function shrinkImage(file, max = 1600) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * k)
      c.height = Math.round(img.height * k)
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      resolve({ data: c.toDataURL('image/jpeg', 0.85).split(',')[1], mime: 'image/jpeg' })
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new ApiError('BAD_IMAGE', 'Не удалось открыть картинку', 0)) }
    img.src = url
  })
}

// Метрики пилота (страница #/stats)
export async function getMetrics(since) {
  if (USE_MOCK) throw new ApiError('OFFLINE', 'Метрики только с сервером', 0)
  return http('GET', '/metrics' + (since ? '?since=' + encodeURIComponent(since) : ''))
}

// Имя Telegram-бота с сервера (null, если бот не настроен или режим моков)
export async function getBotName() {
  if (USE_MOCK) return null
  try { return (await http('GET', '/health')).telegram_bot || null } catch { return null }
}
