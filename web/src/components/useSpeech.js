import { useCallback, useEffect, useRef, useState } from 'react'

const SR = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null
export const FORCE_DEMO = typeof window !== 'undefined' && /[?&#]demo=1/.test(window.location.href)

const norm = (s) => s.replace(/\s+/g, ' ').trim()
// Склейка без повторов: новый кусок, который начинается с уже набранного текста, заменяет его;
// кусок, который уже есть в конце текста, пропускается; иначе дописывается.
export function merge(acc, part) {
  const a = norm(acc)
  const p = norm(part)
  if (!p) return a
  if (!a) return p
  const al = a.toLowerCase()
  const pl = p.toLowerCase()
  if (pl.startsWith(al)) return p
  if (al.endsWith(pl) || al.includes(pl)) return a
  return a + ' ' + p
}

/**
 * Голосовой ввод: настоящее распознавание через Web Speech API.
 * Казахский (kk-KZ); если браузер его не знает — сам переходит на русский (ru-RU).
 * Заготовленный текст печатается ТОЛЬКО в режиме записи видео (?demo=1). Без него — никакой подмены:
 * при ошибке показываем понятное сообщение (error: 'unsupported' | 'denied' | 'nospeech' | 'network' | 'failed').
 */
export default function useSpeech({ lang, demoText, onDone }) {
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [mode, setMode] = useState(null) // 'live' | 'demo'
  const [error, setError] = useState(null)
  const rec = useRef(null)
  const timer = useRef(null)
  const textRef = useRef('')
  const finalRef = useRef('')
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  const finish = useCallback(() => {
    clearInterval(timer.current)
    setListening(false)
    const t = textRef.current.trim()
    if (t) doneRef.current?.(t)
  }, [])

  const runDemo = useCallback(() => {
    setMode('demo')
    setListening(true)
    const words = demoText.split(' ')
    let i = 0
    textRef.current = ''
    setTranscript('')
    clearInterval(timer.current)
    timer.current = setInterval(() => {
      i++
      textRef.current = words.slice(0, i).join(' ')
      setTranscript(textRef.current)
      if (i >= words.length) {
        clearInterval(timer.current)
        setTimeout(finish, 700)
      }
    }, 400)
  }, [demoText, finish])

  const listen = useCallback((locale, allowFallback) => {
    const r = new SR()
    r.lang = locale
    r.interimResults = true
    r.continuous = true
    let failed = null
    r.onresult = (e) => {
      // Chrome на Android присылает результаты накопительно («Ержан», «Ержан привет»),
      // на компьютере — кусками. merge склеивает оба варианта без повторов.
      let text = ''
      for (let k = 0; k < e.results.length; k++) {
        text = merge(text, e.results[k][0].transcript)
      }
      finalRef.current = text
      textRef.current = text
      setTranscript(text)
    }
    r.onerror = (e) => {
      const code = e.error
      if (code === 'aborted') return
      if (code === 'language-not-supported' && allowFallback) {
        failed = 'retry'
        return
      }
      failed = code === 'not-allowed' || code === 'service-not-allowed' ? 'denied'
        : code === 'no-speech' ? 'nospeech'
          : code === 'network' ? 'network'
            : code === 'audio-capture' ? 'denied'
              : 'failed'
    }
    r.onend = () => {
      if (failed === 'retry') {
        try { listen('ru-RU', false) } catch { setError('unsupported'); setListening(false) }
        return
      }
      if (failed && !textRef.current) {
        setError(failed)
        setListening(false)
        return
      }
      finish()
    }
    rec.current = r
    r.start()
  }, [finish])

  const start = useCallback(() => {
    textRef.current = ''
    finalRef.current = ''
    setTranscript('')
    setError(null)
    if (FORCE_DEMO) return runDemo()
    if (!SR) { setError('unsupported'); return }
    try {
      setMode('live')
      setListening(true)
      listen(lang === 'kk' ? 'kk-KZ' : 'ru-RU', lang === 'kk')
    } catch {
      setListening(false)
      setError('failed')
    }
  }, [lang, runDemo, listen])

  const stop = useCallback(() => {
    if (mode === 'demo') {
      textRef.current = demoText
      setTranscript(demoText)
      finish()
    } else {
      try { rec.current?.stop() } catch { finish() }
    }
  }, [mode, demoText, finish])

  useEffect(() => () => { clearInterval(timer.current); try { rec.current?.abort() } catch {} }, [])

  return { listening, transcript, mode, error, start, stop }
}
