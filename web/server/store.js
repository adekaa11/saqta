// Хранилище: Upstash Redis (REST), если подключён в Vercel; иначе память инстанса (локальная разработка).
import { seedAlerts, familyInfo } from '../src/engine.js'

const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
export const storage = REDIS_URL && REDIS_TOKEN ? 'redis' : 'memory'
const mem = globalThis.__saqtaMem || (globalThis.__saqtaMem = new Map())
const DAYS_90 = 60 * 60 * 24 * 90

async function redis(cmd) {
  const r = await fetch(REDIS_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd)
  })
  const j = await r.json()
  if (j.error) throw new Error(j.error)
  return j.result
}

export const DEMO_FAMILY = familyInfo()

// --- JSON-значения ---
export async function getJSON(k) {
  if (storage === 'redis') {
    const raw = await redis(['GET', k])
    return raw ? JSON.parse(raw) : null
  }
  return mem.has(k) ? structuredClone(mem.get(k)) : null
}
export async function setJSON(k, v) {
  if (storage === 'redis') await redis(['SET', k, JSON.stringify(v), 'EX', DAYS_90])
  else mem.set(k, structuredClone(v))
}
async function del(k) {
  if (storage === 'redis') await redis(['DEL', k])
  else mem.delete(k)
}

// --- множества (подписчики семьи) ---
export async function sAdd(k, v) {
  if (storage === 'redis') return redis(['SADD', k, String(v)])
  const s = mem.get(k) || new Set()
  s.add(String(v))
  mem.set(k, s)
}
export async function sMembers(k) {
  if (storage === 'redis') return (await redis(['SMEMBERS', k])) || []
  return [...(mem.get(k) || [])]
}
export async function incr(k) {
  if (storage === 'redis') return redis(['INCR', k])
  mem.set(k, (mem.get(k) || 0) + 1)
  return mem.get(k)
}
export async function getNum(k) {
  if (storage === 'redis') return Number((await redis(['GET', k])) || 0)
  return Number(mem.get(k) || 0)
}

// --- журнал событий для метрик пилота (последние 5000) ---
// Не храним тексты сообщений — только тип, вердикт, время.
const EVENTS = 'saqta:events'
export async function logEvent(e) {
  const item = JSON.stringify({ t: new Date().toISOString(), ...e })
  try {
    if (storage === 'redis') {
      await redis(['LPUSH', EVENTS, item])
      await redis(['LTRIM', EVENTS, '0', '4999'])
    } else {
      const l = mem.get(EVENTS) || []
      l.unshift(item)
      mem.set(EVENTS, l.slice(0, 5000))
    }
  } catch (err) {
    console.error('logEvent failed', err?.message)
  }
}
export async function getEvents() {
  const raw = storage === 'redis' ? (await redis(['LRANGE', EVENTS, '0', '4999'])) || [] : mem.get(EVENTS) || []
  return raw.map((s) => { try { return JSON.parse(s) } catch { return null } }).filter(Boolean)
}

// --- алерты семьи ---
const alertsKey = (fid) => `saqta:alerts:${fid}`
export async function getAlerts(fid) {
  const list = await getJSON(alertsKey(fid))
  if (list) return list
  return fid === DEMO_FAMILY.family_id ? seedAlerts() : []
}
export async function setAlerts(fid, list) {
  await setJSON(alertsKey(fid), list.slice(0, 50))
}
export async function pushAlert(fid, alert) {
  const list = await getAlerts(fid)
  list.unshift(alert)
  await setAlerts(fid, list)
}
export async function resetAlerts(fid) {
  await del(alertsKey(fid))
}

// --- семьи ---
// Демо-семья сайта существует всегда; остальные создаются в Telegram-боте.
export const familyKey = (fid) => `saqta:family:${fid}`
export async function getFamily(fid) {
  if (fid === DEMO_FAMILY.family_id) return { family_id: fid, demo: true }
  return getJSON(familyKey(fid))
}
