// Saqta API — одна функция Vercel на все /api/* (контракт из PLAN.md, раздел 5).
import { makeCheckAlert, makeSosAlert, mocks } from '../src/engine.js'
import { analyze } from './analyze.js'
import { readImage, transcribe } from './media.js'
import { llmEnabled, llmModel, listGeminiModels, listGroqModels } from './llm.js'
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
    if (m === 'GET' && path === '/health') return send(res, 200, { ok: true, storage: db.storage, llm: llmEnabled ? llmModel : null, telegram_bot: await botUsername().catch(() => null) })

    if (m === 'POST' && path === '/telegram') {
      const r = await handleTelegram(req, await readBody(req))
      return send(res, r.status, r.body)
    }
    if (m === 'GET' && path === '/telegram/setup') {
      const r = await setupWebhook()
      return send(res, r.status, r.body)
    }

    if (m === 'GET' && path === '/llm/models') return send(res, 200, { gemini: await listGeminiModels(), groq: await listGroqModels() })

    // Голос с сайта → текст. Тело: { audio: base64, mime } (запись MediaRecorder: webm / mp4 / ogg)
    if (m === 'POST' && path === '/transcribe') {
      const b = await readBody(req)
      const mime = String(b.mime || '').split(';')[0]
      if (!b.audio || !/^audio\/(webm|mp4|ogg|mpeg|wav|aac|x-m4a)$|^video\/(webm|mp4)$/.test(mime)) return fail(res, 400, 'BAD_AUDIO', 'Нужны audio (base64) и mime (audio/webm, audio/mp4, audio/ogg)')
      const buf = Buffer.from(b.audio, 'base64')
      if (buf.length > 4e6) return fail(res, 413, 'AUDIO_TOO_BIG', 'Запись длиннее ~3 минут')
      const t0 = Date.now()
      const text = await transcribe(buf, mime)
      if (text === null) return fail(res, 503, 'STT_UNAVAILABLE', 'Не удалось распознать, попробуйте через минуту')
      return send(res, 200, { text, ms: Date.now() - t0 })
    }

    // Скриншот → текст (сайт и проверки). Тело: { image: base64, mime }
    if (m === 'POST' && path === '/ocr') {
      const b = await readBody(req)
      const mime = /^image\/(png|jpe?g|webp|heic)$/.test(b.mime || '') ? b.mime : null
      if (!b.image || !mime) return fail(res, 400, 'BAD_IMAGE', 'Нужны image (base64) и mime (image/png, image/jpeg, image/webp)')
      const buf = Buffer.from(b.image, 'base64')
      if (buf.length > 4e6) return fail(res, 413, 'IMAGE_TOO_BIG', 'Картинка больше 4 МБ')
      const t0 = Date.now()
      const text = await readImage(buf, mime)
      if (text === null) return fail(res, 503, 'OCR_UNAVAILABLE', 'Не удалось распознать, попробуйте через минуту')
      return send(res, 200, { text, ms: Date.now() - t0 })
    }

    // Метрики пилота из журнала событий: ?since=2026-11-25 (по умолчанию — PILOT_START или 25.11.2026).
    // Мои тесты до старта пилота сюда не попадают.
    if (m === 'GET' && path === '/metrics') {
      const since = new Date(url.searchParams.get('since') || process.env.PILOT_START || '2026-11-25T00:00:00+05:00')
      const ev = (await db.getEvents()).filter((e) => new Date(e.t) >= since)
      const checks = ev.filter((e) => e.type === 'check')
      const alerts = ev.filter((e) => e.type === 'alert' && !e.demo)
      const med = (a) => { const s = a.filter((x) => typeof x === 'number').sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) / 2)] : null }
      const p90 = (a) => { const s = a.filter((x) => typeof x === 'number').sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * 0.9))] : null }
      const count = (a, k) => a.reduce((o, e) => ((o[e[k] ?? '—'] = (o[e[k] ?? '—'] || 0) + 1), o), {})
      return send(res, 200, {
        since: since.toISOString(),
        families_created: ev.filter((e) => e.type === 'family_created').length,
        elders_joined: ev.filter((e) => e.type === 'elder_joined').length,
        checks: {
          total: checks.length,
          by_verdict: count(checks, 'verdict'),
          by_input: count(checks, 'input'),
          by_src: count(checks, 'src'),
          by_engine: count(checks, 'engine'),
          median_ms: med(checks.map((e) => e.ms)),
          p90_ms: p90(checks.map((e) => e.ms))
        },
        alerts: {
          total: alerts.length,
          by_kind: count(alerts, 'kind'),
          delivered: alerts.filter((e) => e.delivered > 0).length,
          median_total_ms: med(alerts.map((e) => e.total_ms)),
          median_delivery_ms: med(alerts.map((e) => e.delivery_ms))
        },
        demo_alerts: ev.filter((e) => e.type === 'alert' && e.demo).length
      })
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
      const t0 = Date.now()
      const r = await analyze(text)
      // Прогоны теста точности (scripts/eval.mjs) не считаем пилотом и не шлём тревог
      if (b.eval === true) { r.family_alert_sent = false; return send(res, 200, r) }
      await db.incr('saqta:stats:checks')
      await db.incr(`saqta:stats:checks:${r.verdict}`)
      await db.logEvent({ type: 'check', src: 'site', input: b.source === 'voice' || b.source === 'screenshot' ? b.source : 'text', verdict: r.verdict, score: r.risk_score, engine: r.engine, ms: Date.now() - t0 })
      r.family_alert_sent = false
      if (r.verdict === 'scam' && b.family_id && (await db.getFamily(b.family_id))) {
        await raiseAlert(b.family_id, makeCheckAlert(r, text, b.member_name || 'Гүлнар апа'), t0)
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
