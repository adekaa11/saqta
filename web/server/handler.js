// Saqta API — одна функция Vercel на все /api/* (контракт из PLAN.md, раздел 5).
// Хранилище: Upstash Redis (REST), если подключён в Vercel; иначе память инстанса.
import { analyzeText, makeCheckAlert, makeSosAlert, seedAlerts, familyInfo, mocks } from '../src/engine.js'

const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
const storage = REDIS_URL && REDIS_TOKEN ? 'redis' : 'memory'
const mem = globalThis.__saqtaMem || (globalThis.__saqtaMem = new Map())

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

const key = (fid) => `saqta:alerts:${fid}`
async function getAlerts(fid) {
  if (storage === 'redis') {
    const raw = await redis(['GET', key(fid)])
    return raw ? JSON.parse(raw) : seedAlerts()
  }
  return mem.get(key(fid)) || seedAlerts()
}
async function setAlerts(fid, list) {
  const trimmed = list.slice(0, 50)
  if (storage === 'redis') await redis(['SET', key(fid), JSON.stringify(trimmed), 'EX', 60 * 60 * 24 * 30])
  else mem.set(key(fid), trimmed)
}
async function resetAlerts(fid) {
  if (storage === 'redis') await redis(['DEL', key(fid)])
  else mem.delete(key(fid))
}

const FAMILY = familyInfo()
const familyExists = (fid) => fid === FAMILY.family_id

function send(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.end(JSON.stringify(body))
}
const fail = (res, status, code, message) => send(res, status, { error: { code, message } })

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string') { try { return JSON.parse(req.body) } catch { return {} } }
  const chunks = []
  for await (const c of req) chunks.push(c)
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') } catch { return {} }
}

export default async function handler(req, res) {
  const url = new URL(req.url, 'http://x')
  const fromRoute = url.searchParams.get('__p')
  const path = ((fromRoute ?? url.pathname.replace(/^\/api/, '')) || '/').replace(/(.)\/$/, '$1')
  const m = req.method

  if (m === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    return send(res, 204, {})
  }

  try {
    if (m === 'GET' && path === '/health') return send(res, 200, { ok: true, storage })

    if (m === 'POST' && path === '/analyze') {
      const b = await readBody(req)
      const text = (b.text || '').trim()
      if (!text) return fail(res, 400, 'EMPTY_TEXT', 'Текст сообщения пустой')
      if (text.length > 4000) return fail(res, 413, 'TEXT_TOO_LONG', 'Слишком длинный текст')
      const r = analyzeText(text)
      r.family_alert_sent = false
      if (r.verdict === 'scam' && b.family_id && familyExists(b.family_id)) {
        const list = await getAlerts(b.family_id)
        list.unshift(makeCheckAlert(r, text, b.member_name || 'Гүлнар апа'))
        await setAlerts(b.family_id, list)
        r.family_alert_sent = true
      }
      return send(res, 200, r)
    }

    let mm
    if ((mm = path.match(/^\/families\/([^/]+)\/alerts$/)) && m === 'GET') {
      if (!familyExists(mm[1])) return fail(res, 404, 'FAMILY_NOT_FOUND', 'Семья не найдена')
      return send(res, 200, { ...FAMILY, alerts: await getAlerts(mm[1]) })
    }
    if ((mm = path.match(/^\/families\/([^/]+)\/sos$/)) && m === 'POST') {
      if (!familyExists(mm[1])) return fail(res, 404, 'FAMILY_NOT_FOUND', 'Семья не найдена')
      const b = await readBody(req)
      const alert = makeSosAlert(b.member_name || 'Гүлнар апа', b.note)
      const list = await getAlerts(mm[1])
      list.unshift(alert)
      await setAlerts(mm[1], list)
      return send(res, 201, alert)
    }
    if ((mm = path.match(/^\/families\/([^/]+)\/reset$/)) && m === 'POST') {
      if (!familyExists(mm[1])) return fail(res, 404, 'FAMILY_NOT_FOUND', 'Семья не найдена')
      await resetAlerts(mm[1])
      return send(res, 200, { ok: true })
    }
    if ((mm = path.match(/^\/alerts\/([^/]+)$/)) && m === 'PATCH') {
      const b = await readBody(req)
      if (!['seen', 'resolved'].includes(b.status)) return fail(res, 400, 'INVALID_STATUS', 'Допустимо seen или resolved')
      const fid = FAMILY.family_id
      const list = await getAlerts(fid)
      const a = list.find((x) => x.id === mm[1])
      if (!a) return fail(res, 404, 'ALERT_NOT_FOUND', 'Алерт не найден')
      a.status = b.status
      await setAlerts(fid, list)
      return send(res, 200, a)
    }

    if (m === 'GET' && path === '/schemes') return send(res, 200, mocks.schemes)
    if (m === 'GET' && path === '/radar') return send(res, 200, mocks.radar)
    if (m === 'POST' && path === '/reports') {
      const b = await readBody(req)
      if (!b.text || !b.scheme_code || !b.region_code) return fail(res, 400, 'VALIDATION_ERROR', 'Нужны text, scheme_code, region_code')
      return send(res, 201, { id: 'rep_' + Math.random().toString(36).slice(2, 6), status: 'accepted' })
    }

    return fail(res, 404, 'NOT_FOUND', 'Нет такого эндпоинта')
  } catch (e) {
    return fail(res, 500, 'ANALYZE_FAILED', String(e?.message || e))
  }
}
