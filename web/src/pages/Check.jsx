import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { analyze, sendSos, ocrImage, demoMessages, FAMILY_ID, MEMBER_NAME } from '../api'
import { useLang, FLAG_META } from '../i18n'
import Gauge, { VERDICT_COLOR } from '../components/Gauge.jsx'
import Highlighted, { orderFlags } from '../components/Highlighted.jsx'
import RimGlow from '../components/RimGlow.jsx'
import Ornament from '../components/Ornament.jsx'
import Reveal from '../components/Reveal.jsx'
import useSpeech from '../components/useSpeech'
import { MicIcon, PhoneIcon, AlertIcon, CheckIcon, ArrowRotateIcon, ImageIcon } from '../components/Icons.jsx'

const SON_PHONE = 'tel:+77010000000' // демо-номер
const ease = [0.16, 1, 0.3, 1]
// Главная кнопка: кобальт с золотой внутренней линией
const PRIMARY = 'bg-cobalt text-white shadow-[inset_0_0_0_3px_rgb(var(--cobalt)),inset_0_0_0_4.5px_rgb(var(--gold))] hover:bg-cobalt-press'

function Spinner({ dark }) {
  return <span className={`inline-block h-6 w-6 animate-spin rounded-full border-[3px] ${dark ? 'border-cobalt/30 border-t-cobalt' : 'border-white/40 border-t-white'}`} />
}

export default function Check() {
  const { t, lang } = useLang()
  const [text, setText] = useState('')
  const [source, setSource] = useState('whatsapp')
  const [state, setState] = useState('idle') // idle | loading | result | error
  const [result, setResult] = useState(null)
  const [checked, setChecked] = useState('')
  const [err, setErr] = useState(null)
  const [active, setActive] = useState(null)
  const [sos, setSos] = useState('idle') // idle | sending | sent
  const [glow, setGlow] = useState(0)
  const [shot, setShot] = useState(false) // читаем скриншот

  const onShot = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setShot(true)
    setErr(null)
    if (state === 'error') setState('idle')
    try {
      const tx = (await ocrImage(file)).trim()
      if (!tx) { setErr({ message: t.shotEmpty }); setState('error'); return }
      setText(tx)
      setSource('screenshot')
      await run(tx, 'screenshot')
    } catch {
      setErr({ message: t.shotFail })
      setState('error')
    } finally {
      setShot(false)
    }
  }

  const voiceDemo = demoMessages.find((d) => d.key === (lang === 'kk' ? 'voice_kk' : 'voice_ru'))

  const run = async (txt, src) => {
    const body = (txt ?? text).trim()
    if (!body) { setErr({ message: t.empty }); setState('error'); return }
    setState('loading')
    setErr(null)
    setActive(null)
    setChecked(body)
    try {
      const r = await analyze({ text: body, source: src || source, lang: 'auto', family_id: FAMILY_ID, member_name: MEMBER_NAME })
      setResult(r)
      setState('result')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      if (r.verdict === 'scam') setTimeout(() => setGlow(Date.now()), 900)
    } catch (e) {
      setErr(e)
      setState('error')
    }
  }

  const speech = useSpeech({
    lang,
    demoText: voiceDemo?.text || '',
    onDone: (tx) => { setText(tx); setSource('voice'); run(tx, 'voice') }
  })

  const onSos = async () => {
    if (sos === 'sending') return
    setSos('sending')
    setGlow(Date.now())
    try {
      await sendSos({ member_name: MEMBER_NAME, note: lang === 'kk' ? 'маған қазір қоңырау шалып жатыр' : 'мне сейчас звонят' })
      setSos('sent')
      setTimeout(() => setSos('idle'), 6000)
    } catch {
      setSos('idle')
    }
  }

  const reset = () => { setState('idle'); setResult(null); setText(''); setActive(null) }
  const textExamples = demoMessages.filter((d) => !d.key.startsWith('voice'))

  return (
    <div>
      <RimGlow pulse={glow} />
      <AnimatePresence mode="popLayout" initial={false}>
        {state !== 'result' ? (
          <motion.section key="input" initial={false} className="mx-auto max-w-2xl px-3 sm:px-6">
            <div className="pb-6 pt-8">
              <h1 className="text-[36px] font-black leading-[1.08] tracking-tight text-cobalt-deep sm:text-[42px]">{t.hello}</h1>
              <p className="mt-3 max-w-lg text-xl leading-snug text-ink-soft">{t.lead}</p>
            </div>

            <Ornament />

            {/* Кесе-микрофон — главный предмет экрана */}
            <div className="flex flex-col items-center pt-10 text-center">
              <div className="relative">
                {speech.listening && (
                  <motion.span
                    className="absolute -inset-[11px] rounded-full border-[3px] border-gold"
                    animate={{ scale: [1, 1.18], opacity: [1, 0] }}
                    transition={{ duration: 1.3, repeat: Infinity, ease: 'easeOut' }}
                  />
                )}
                <button
                  onClick={speech.listening ? speech.stop : speech.start}
                  disabled={state === 'loading'}
                  className={`focus-ring relative grid h-[184px] w-[184px] place-items-center rounded-full text-white shadow-kese transition-[transform,background-color] duration-200 active:scale-95 disabled:opacity-60 ${speech.listening ? 'bg-cobalt-press' : 'bg-cobalt hover:bg-cobalt-press'}`}
                  aria-label={speech.listening ? t.micStop : t.micIdle}
                >
                  <span className="absolute inset-[12px] rounded-full border-[1.5px] border-gold/80" aria-hidden />
                  <MicIcon className="h-[72px] w-[72px]" />
                </button>
              </div>
              <div className="mt-8 text-[32px] font-black leading-none tracking-tight text-cobalt-deep">{speech.listening ? t.micListening : t.micIdle}</div>
              {!speech.listening && <p className="mt-3 text-xl text-ink">{t.micSub}</p>}
              {speech.listening && speech.mode === 'live' && <p className="mt-3 text-xl font-semibold text-ink">{t.micHint}</p>}
              {speech.error && !speech.listening && (
                <p role="alert" className="mt-4 flex max-w-md items-start gap-3 rounded-xl border-2 border-risk-scam bg-risk-scamTint px-4 py-3 text-left text-lg font-semibold text-risk-scam">
                  <AlertIcon className="mt-0.5 h-6 w-6 shrink-0" /> {t.micErr[speech.error] || t.micErr.failed}
                </p>
              )}
              <p className="mt-5 inline-flex items-center gap-2.5 text-lg font-bold text-cobalt-deep">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-gold bg-cobalt-tint text-base font-black">Е</span>
                {t.guardianLine}
              </p>

              <AnimatePresence>
                {(speech.listening || (speech.transcript && state === 'loading')) && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="w-full overflow-hidden">
                    <p className="mt-6 min-h-[4rem] rounded-2xl border-2 border-cobalt bg-porcelain-glaze px-5 py-4 text-left text-[21px] leading-relaxed text-ink">
                      {speech.transcript || '…'}
                      {speech.listening && <span className="ml-1 inline-block h-6 w-[3px] translate-y-1 animate-pulse rounded bg-cobalt" />}
                    </p>
                    {speech.listening && (
                      <button onClick={speech.stop} className={`focus-ring mt-4 rounded-xl px-8 py-3 text-xl font-black ${PRIMARY}`}>{t.micStop}</button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Текст сообщения */}
            <Reveal>
            <Ornament className="mt-12">{t.or}</Ornament>
            <div className="mt-6 pb-4">
              <label htmlFor="msg" className="sr-only">{t.placeholder}</label>
              <textarea
                id="msg"
                value={text}
                onChange={(e) => { setText(e.target.value); if (source === 'voice') setSource('whatsapp') }}
                placeholder={t.placeholder}
                rows={4}
                className="w-full resize-none rounded-xl border-2 border-cobalt bg-porcelain-glaze px-5 py-4 text-[21px] leading-relaxed text-ink placeholder:text-ink-soft focus:outline-none focus:ring-4 focus:ring-gold/50"
              />
              <div className="mt-4 flex flex-wrap items-center gap-2.5">
                <span className="mr-1 text-lg font-bold text-ink">{t.examples}</span>
                {textExamples.map((d) => (
                  <button
                    key={d.key}
                    onClick={() => { setText(d.text); setSource(d.source) }}
                    className="focus-ring rounded-lg border-2 border-cobalt bg-porcelain-glaze px-4 py-2 text-lg font-bold text-cobalt-deep transition-colors hover:bg-cobalt hover:text-white"
                  >
                    {t.exampleLabels[d.key] || d.label}
                  </button>
                ))}
              </div>
              <label className={`focus-ring mt-4 flex h-14 w-full cursor-pointer items-center justify-center gap-3 rounded-xl border-2 border-cobalt bg-porcelain-glaze text-xl font-black text-cobalt-deep transition-colors hover:bg-cobalt-tint ${shot || state === 'loading' ? 'pointer-events-none opacity-70' : ''}`}>
                {shot ? <><Spinner dark />{t.shotReading}</> : <><ImageIcon className="h-7 w-7" />{t.shotBtn}</>}
                <input type="file" accept="image/*" className="sr-only" onChange={onShot} disabled={shot || state === 'loading'} />
              </label>
              <button
                onClick={() => run()}
                disabled={state === 'loading' || speech.listening || shot}
                className={`focus-ring mt-6 flex h-16 w-full items-center justify-center gap-3 rounded-xl text-[24px] font-black transition-colors disabled:opacity-70 ${PRIMARY}`}
              >
                {state === 'loading' ? <><Spinner />{t.checking}</> : t.check}
              </button>
              {state === 'error' && (
                <div role="alert" className="mt-4 flex items-center justify-between gap-3 rounded-xl border-2 border-risk-scam bg-risk-scamTint px-5 py-4 text-lg text-risk-scam">
                  <span className="font-bold">{err?.message || t.error}</span>
                  {err?.code && <button onClick={() => run()} className="font-black underline underline-offset-4">{t.retry}</button>}
                </div>
              )}
            </div>
            </Reveal>
          </motion.section>
        ) : (
          <Result key="result" result={result} text={checked} active={active} setActive={setActive} onReset={reset} />
        )}
      </AnimatePresence>

      {/* SOS — всегда на виду, внутри бордюра */}
      <div className="fixed inset-x-[16px] bottom-[16px] z-40 border-t-2 border-cobalt bg-porcelain px-[12px] pb-[14px] pt-3">
        <div className="mx-auto max-w-2xl">
          <AnimatePresence>
            {sos === 'sent' && (
              <motion.div role="status" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="mb-3 flex items-center gap-3 rounded-xl bg-cobalt-press px-4 py-3 text-lg font-bold text-white">
                <CheckIcon className="h-6 w-6 shrink-0 text-gold-soft" /> {t.sosSent}
              </motion.div>
            )}
          </AnimatePresence>
          <button
            onClick={onSos}
            className="focus-ring flex min-h-[68px] w-full items-center gap-4 rounded-xl bg-risk-scam px-4 py-2.5 text-left text-white shadow-[inset_0_0_0_3px_rgb(var(--scam)),inset_0_0_0_4.5px_rgba(255,255,255,.7)] transition-[filter,transform] hover:brightness-110 active:scale-[.99]"
          >
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border-2 border-white text-lg font-black">SOS</span>
            <span className="leading-tight">
              <span className="block text-xl font-black">{sos === 'sending' ? '…' : t.sos}</span>
              <span className="mt-0.5 hidden text-lg font-semibold text-white sm:block">{t.sosSub}</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}

function Result({ result, text, active, setActive, onReset }) {
  const { t, lang } = useLang()
  const r = result
  const color = VERDICT_COLOR[r.verdict]
  const flags = orderFlags(text, r.red_flags || [])
  const advice = lang === 'kk' ? r.advice_kk : r.advice_ru
  const flagStart = 1.1

  return (
    <motion.section initial={false} className="mx-auto max-w-2xl px-3 sm:px-6">
      {/* Вердикт */}
      <div className="pb-8 pt-9 text-center">
        <h1 className="sr-only">{t.risk}</h1>
        <Gauge score={r.risk_score} verdict={r.verdict} />
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.5, ease }}
          className="mt-7 text-[46px] font-black leading-none tracking-tight sm:text-[54px]"
          style={{ color }}
        >
          {t.verdict[r.verdict]}
        </motion.div>
        <div className="mt-3 text-[24px] font-black text-ink">{lang === 'kk' ? r.scheme?.title_kk : r.scheme?.title_ru}</div>
        <p className="mx-auto mt-2 max-w-md text-xl leading-snug text-ink-soft">{lang === 'kk' ? r.summary_kk : r.summary_ru}</p>
        {r.family_alert_sent && (
          <motion.div
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.5 + flags.length * 0.35, duration: 0.4, ease }}
            className="mt-6 inline-flex items-center gap-2.5 rounded-lg border-2 border-cobalt bg-porcelain-glaze px-4 py-2 text-lg font-bold text-cobalt-deep"
          >
            <CheckIcon className="h-6 w-6 text-gold" /> {t.alertSent}
          </motion.div>
        )}
      </div>

      <Ornament />

      <h2 className="mt-9 text-[26px] font-black text-cobalt-deep">{t.said}</h2>
      <div className="mt-3 rounded-2xl border-2 border-cobalt bg-porcelain-glaze px-5 py-4">
        <Highlighted text={text} flags={flags} active={active} onHover={setActive} baseDelay={flagStart} />
      </div>

      {flags.length > 0 && (
        <>
          <h2 className="mt-10 text-[26px] font-black text-cobalt-deep">{t.why}</h2>
          <ol className="mt-3 border-y-2 border-cobalt">
            {flags.map((f, i) => {
              const meta = FLAG_META[f.type] || FLAG_META.urgency
              return (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: flagStart + i * 0.35, duration: 0.4, ease }}
                  onMouseEnter={() => setActive(i)}
                  onMouseLeave={() => setActive(null)}
                  className={`flex gap-4 border-cobalt px-2 py-5 transition-colors [&:not(:first-child)]:border-t-[1.5px] ${active === i ? 'bg-risk-scamTint' : ''}`}
                >
                  <span className="num mt-0.5 h-10 w-10 bg-risk-scam text-xl text-white">{i + 1}</span>
                  <div className="min-w-0">
                    <div className="text-lg font-black text-risk-scam">{meta[lang]}</div>
                    <div className="mt-0.5 text-[21px] font-bold leading-snug text-ink">«{f.text}»</div>
                    <p className="mt-1 text-xl leading-snug text-ink-soft">{lang === 'kk' ? f.explanation_kk : f.explanation_ru}</p>
                  </div>
                </motion.li>
              )
            })}
          </ol>
        </>
      )}

      <Reveal>
      {advice?.length > 0 && (
        <>
          <h2 className="mt-10 text-[26px] font-black text-cobalt-deep">{t.whatToDo}</h2>
          <ol className="mt-4 space-y-4">
            {advice.map((a, i) => (
              <li key={i} className="flex gap-4 text-[21px] leading-snug">
                <span className="num h-10 w-10 bg-cobalt text-xl text-white shadow-[0_0_0_3px_rgb(var(--porcelain)),0_0_0_4.5px_rgb(var(--gold))]">{i + 1}</span>
                <span className="pt-1.5">{a}</span>
              </li>
            ))}
          </ol>
        </>
      )}

      <div className="mt-10 grid gap-3 sm:grid-cols-2">
        {r.verdict !== 'safe' && (
          <a href={SON_PHONE} className={`focus-ring flex h-16 items-center justify-center gap-3 rounded-xl text-xl font-black ${PRIMARY}`}>
            <PhoneIcon className="h-6 w-6" /> {t.callSon}
          </a>
        )}
        <button onClick={onReset} className={`focus-ring flex h-16 items-center justify-center gap-3 rounded-xl border-2 border-cobalt bg-porcelain-glaze text-xl font-black text-cobalt-deep hover:bg-cobalt-tint ${r.verdict === 'safe' ? 'sm:col-span-2' : ''}`}>
          <ArrowRotateIcon className="h-6 w-6" /> {t.again}
        </button>
      </div>
      {r.verdict === 'scam' && (
        <p className="mt-6 flex items-start gap-3 pb-4 text-xl text-ink">
          <AlertIcon className="mt-0.5 h-7 w-7 shrink-0 text-risk-scam" />
          {lang === 'kk' ? 'Банк ешқашан SMS-кодты телефонмен сұрамайды.' : 'Банк никогда не спрашивает код из SMS по телефону.'}
        </p>
      )}
      </Reveal>
    </motion.section>
  )
}
