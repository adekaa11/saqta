// Saqta API — одна функция Vercel на все /api/* (контракт из PLAN.md, раздел 5).
import { analyzeText, makeCheckAlert, makeSosAlert, mocks } from '../src/engine.js'
import * as db from './store.js'
import { raiseAlert, handleTelegram, setupWebhook, botUsername } from './telegram.js'

const FAMILY = db.DEMO_FAMILY

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
    if (m === 'GET' && path === '/health') return send(res, 200, { ok: true, storage: db.storage, telegram_bot: await botUsername().catch(() => null) })

    if (m === 'POST' && path === '/telegram') {
      const r = await handleTelegram(req, await readBody(req))
      return send(res, r.status, r.body)
    }
    if (m === 'GET' && path === '/telegram/setup') {
      const r = await setupWebhook()
      return send(res, r.status, r.body)
    }

    if (m === 'GET' && path === '/stats') {
      const keys = ['checks', 'checks:scam', 'checks:suspicious', 'checks:safe', 'alerts', 'families', 'elders']
      const vals = await Promise.all(keys.map((k) => db.getNum(`saqta:stats:${k}`)))
      return send(res, 200, Object.fromEntries(keys.map((k, i) => [k.replace(':', '_'), vals[i]])))
    }

    if (m === 'POST' && path === '/analyze') {
      const b = await readBody(req)
      const text = (b.text || '').trim()
      if (!text) return fail(res, 400, 'EMPTY_TEXT', 'Текст сообщения пустой')
      if (text.length > 4000) return fail(res, 413, 'TEXT_TOO_LONG', 'Слишком длинный текст')
      const r = analyzeText(text)
      await db.incr('saqta:stats:checks')
      await db.incr(`saqta:stats:checks:${r.verdict}`)
      r.family_alert_sent = false
      if (r.verdict === 'scam' && b.family_id && (await db.getFamily(b.family_id))) {
        await raiseAlert(b.family_id, makeCheckAlert(r, text, b.member_name || 'Гүлнар апа'))
        r.family_alert_sent = true
      }
      return send(res, 200, r)
    }

    let mm
    if ((mm = path.match(/^\/families\/([^/]+)\/alerts$/)) && m === 'GET') {
      if (!(await db.getFamily(mm[1]))) return fail(res, 404, 'FAMILY_NOT_FOUND', 'Семья не найдена')
      return send(res, 200, { ...FAMILY, family_id: mm[1], alerts: await db.getAlerts(mm[1]) })
    }
    if ((mm = path.match(/^\/families\/([^/]+)\/sos$/)) && m === 'POST') {
      if (!(await db.getFamily(mm[1]))) return fail(res, 404, 'FAMILY_NOT_FOUND', 'Семья не найдена')
      const b = await readBody(req)
      const alert = await raiseAlert(mm[1], makeSosAlert(b.member_name || 'Гүлнар апа', b.note))
      return send(res, 201, alert)
    }
    if ((mm = path.match(/^\/families\/([^/]+)\/reset$/)) && m === 'POST') {
      if (mm[1] !== FAMILY.family_id) return fail(res, 404, 'FAMILY_NOT_FOUND', 'Семья не найдена')
      await db.resetAlerts(mm[1])
      return send(res, 200, { ok: true })
    }
    if ((mm = path.match(/^\/alerts\/([^/]+)$/)) && m === 'PATCH') {
      const b = await readBody(req)
      if (!['seen', 'resolved'].includes(b.status)) return fail(res, 400, 'INVALID_STATUS', 'Допустимо seen или resolved')
      const fid = FAMILY.family_id
      const list = await db.getAlerts(fid)
      const a = list.find((x) => x.id === mm[1])
      if (!a) return fail(res, 404, 'ALERT_NOT_FOUND', 'Алерт не найден')
      a.status = b.status
      await db.setAlerts(fid, list)
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
