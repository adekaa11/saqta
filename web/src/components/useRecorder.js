import { useCallback, useEffect, useRef, useState } from 'react'
import { transcribeAudio } from '../api'

const MAX_SEC = 90
const pickMime = () => {
  if (typeof MediaRecorder === 'undefined') return null
  for (const m of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']) {
    if (MediaRecorder.isTypeSupported?.(m)) return m
  }
  return ''
}

/**
 * Голосовой ввод через сервер: браузер только записывает звук, расшифровывает ИИ на сервере
 * (тот же, что в Telegram-боте). Работает в любом современном браузере, включая iPhone, и понимает казахский.
 * Интерфейс как у useSpeech: { listening, transcript, mode, error, start, stop } + busy (идёт расшифровка), seconds.
 * error: 'unsupported' | 'denied' | 'nospeech' | 'network' | 'failed'
 */
export default function useRecorder({ onDone }) {
  const [listening, setListening] = useState(false)
  const [busy, setBusy] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState(null)
  const [seconds, setSeconds] = useState(0)
  const rec = useRef(null)
  const chunks = useRef([])
  const tick = useRef(null)
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  const cleanup = () => {
    clearInterval(tick.current)
    rec.current?.stream?.getTracks().forEach((t) => t.stop())
  }
  useEffect(() => cleanup, [])

  const stop = useCallback(() => {
    if (rec.current && rec.current.state !== 'inactive') rec.current.stop()
  }, [])

  const start = useCallback(async () => {
    setError(null)
    setTranscript('')
    const mime = pickMime()
    if (mime === null || !navigator.mediaDevices?.getUserMedia) { setError('unsupported'); return }
    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (e) {
      setError(e?.name === 'NotAllowedError' || e?.name === 'SecurityError' ? 'denied' : 'unsupported')
      return
    }
    const r = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
    rec.current = r
    chunks.current = []
    const startedAt = Date.now()
    r.ondataavailable = (e) => { if (e.data?.size) chunks.current.push(e.data) }
    r.onstop = async () => {
      cleanup()
      setListening(false)
      const type = (r.mimeType || mime || 'audio/webm').split(';')[0]
      const blob = new Blob(chunks.current, { type })
      if (Date.now() - startedAt < 800 || blob.size < 2000) { setError('nospeech'); return }
      setBusy(true)
      try {
        const text = (await transcribeAudio(blob, type)).trim()
        if (!text) { setError('nospeech'); return }
        setTranscript(text)
        doneRef.current?.(text)
      } catch (e) {
        setError(e?.code === 'NETWORK' ? 'network' : 'failed')
      } finally {
        setBusy(false)
      }
    }
    r.start(1000)
    setSeconds(0)
    setListening(true)
    tick.current = setInterval(() => {
      const s = Math.round((Date.now() - startedAt) / 1000)
      setSeconds(s)
      if (s >= MAX_SEC) stop()
    }, 500)
  }, [stop])

  return { listening, busy, transcript, mode: 'live', error, start, stop, seconds }
}
