import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { getAlerts, patchAlert, USE_MOCK } from '../api'
import { useLang, timeAgo } from '../i18n'
import RimGlow from '../components/RimGlow.jsx'
import Ornament from '../components/Ornament.jsx'
import Reveal from '../components/Reveal.jsx'
import { PhoneIcon, BellIcon, BellOffIcon, AlertIcon, CheckIcon } from '../components/Icons.jsx'

const MOM_PHONE = 'tel:+77020000000' // демо-номер
let audioCtx = null

function beep(kind) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)()
    const tones = kind === 'sos' ? [880, 660, 880, 660] : [740, 990]
    tones.forEach((f, i) => {
      const o = audioCtx.createOscillator()
      const g = audioCtx.createGain()
      o.type = 'sine'
      o.frequency.value = f
      const t0 = audioCtx.currentTime + i * 0.16
      g.gain.setValueAtTime(0.0001, t0)
      g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.15)
      o.connect(g).connect(audioCtx.destination)
      o.start(t0)
      o.stop(t0 + 0.16)
    })
  } catch {}
}

export default function Family() {
  const { t, lang } = useLang()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [sound, setSound] = useState(false)
  const [glow, setGlow] = useState(0)
  const [fresh, setFresh] = useState(null)
  const [, tick] = useState(0)
  const known = useRef(null)
  const soundRef = useRef(sound)
  soundRef.current = sound

  const load = useCallback(async () => {
    try {
      const d = await getAlerts()
      setError(null)
      const ids = new Set(d.alerts.map((a) => a.id))
      if (known.current) {
        const added = d.alerts.filter((a) => !known.current.has(a.id))
        if (added.length) {
          setFresh(added[0].id)
          setGlow(Date.now())
          if (soundRef.current) beep(added[0].type)
        }
      }
      known.current = ids
      setData(d)
    } catch (e) {
      setError(e)
    }
  }, [])

  useEffect(() => {
    load()
    const iv = setInterval(load, 3000)
    const tk = setInterval(() => tick((x) => x + 1), 30000)
    const onStorage = () => USE_MOCK && load()
    window.addEventListener('storage', onStorage)
    return () => { clearInterval(iv); clearInterval(tk); window.removeEventListener('storage', onStorage) }
  }, [load])

  const markSeen = async (id) => {
    setData((d) => ({ ...d, alerts: d.alerts.map((a) => (a.id === id ? { ...a, status: 'seen' } : a)) }))
    try { await patchAlert(id, 'seen') } catch {}
  }

  const mom = data?.members?.find((m) => m.role === 'protected')
  const me = data?.members?.find((m) => m.role === 'guardian')
  const alerts = data?.alerts || []
  const newOnes = alerts.filter((a) => a.status === 'new')
  const oldOnes = alerts.filter((a) => a.status !== 'new')
  const scheme = (a) => (lang === 'kk' ? a.scheme?.title_kk : a.scheme?.title_ru)
  const headline = (a) => (a.type === 'sos' ? `${a.member_name} — SOS` : `${a.member_name} — ${t.verdict[a.verdict] || ''} ${a.risk_score}/100`)

  return (
    <div className="mx-auto max-w-3xl px-3 sm:px-6">
      <RimGlow pulse={glow} />

      <div className="pb-6 pt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2.5 text-lg font-bold text-cobalt-deep">
            <motion.span className="h-2.5 w-2.5 rotate-45 border-[1.5px] border-cobalt bg-gold" animate={{ opacity: [1, 0.35, 1] }} transition={{ duration: 2.4, repeat: Infinity }} />
            {t.liveNote}
          </span>
          <button
            onClick={() => { const next = !sound; setSound(next); if (next) beep('check') }}
            aria-pressed={sound}
            className={`focus-ring inline-flex items-center gap-2 rounded-lg border-2 border-cobalt px-4 py-2 text-lg font-bold ${sound ? 'bg-cobalt text-white' : 'bg-porcelain-glaze text-cobalt-deep hover:bg-cobalt-tint'}`}
          >
            {sound ? <BellIcon className="h-6 w-6" /> : <BellOffIcon className="h-6 w-6" />}
            {sound ? t.soundOffBtn : t.soundOff}
          </button>
        </div>
        <h1 className="mt-5 text-[36px] font-black leading-[1.08] tracking-tight text-cobalt-deep sm:text-[42px]">{t.famHello}</h1>
        <p className="mt-2 max-w-lg text-xl font-bold leading-snug text-ink">{t.famMomLine}</p>
        <p className="mt-1 max-w-lg text-xl leading-snug text-ink-soft">{t.famLead}</p>
      </div>

      {/* Новые алерты — первыми, ярко */}
      <ul className="space-y-4">
        <AnimatePresence initial={false}>
          {newOnes.map((a) => {
            const isSos = a.type === 'sos'
            const justIn = a.id === fresh
            return (
              <motion.li
                key={a.id}
                layout
                role="alert"
                initial={{ y: -36, scale: 0.94 }}
                animate={{ y: 0, scale: 1, boxShadow: justIn ? ['0 0 0 0 rgba(194,40,26,.6)', '0 0 0 14px rgba(194,40,26,0)', '0 0 0 0 rgba(194,40,26,.6)', '0 0 0 14px rgba(194,40,26,0)'] : '0 0 0 0 rgba(194,40,26,0)' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ type: 'spring', stiffness: 320, damping: 24, boxShadow: { duration: 2.2 } }}
                className="overflow-hidden rounded-xl border-[3px] border-risk-scam bg-porcelain-glaze"
              >
                <div className="flex items-center gap-3 bg-risk-scam px-4 py-3 text-white">
                  {isSos
                    ? <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-white text-lg font-black">SOS</span>
                    : <AlertIcon className="h-8 w-8 shrink-0" />}
                  <div className="text-[24px] font-black leading-tight">{headline(a)}</div>
                </div>
                <div className="px-4 py-4 sm:px-5">
                  {!isSos && <div className="text-[22px] font-black text-risk-scam">{scheme(a)}</div>}
                  <p className="mt-1 text-xl leading-snug text-ink">«{a.text_preview}»</p>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <a href={MOM_PHONE} className="focus-ring inline-flex min-h-14 items-center gap-2.5 rounded-xl bg-cobalt px-5 py-2 text-xl font-black text-white shadow-[inset_0_0_0_3px_rgb(var(--cobalt)),inset_0_0_0_4.5px_rgb(var(--gold))] hover:bg-cobalt-press">
                      <PhoneIcon className="h-6 w-6" /> {t.callMom}
                    </a>
                    <button onClick={() => markSeen(a.id)} className="focus-ring inline-flex min-h-14 items-center rounded-xl border-2 border-cobalt px-5 text-xl font-black text-cobalt-deep hover:bg-cobalt-tint">{t.seenBtn}</button>
                    <span className="ml-auto text-lg font-semibold text-ink-soft">{timeAgo(a.created_at, t)}</span>
                  </div>
                </div>
              </motion.li>
            )
          })}
        </AnimatePresence>
      </ul>

      {/* Семья — строка с линиями, без карточек */}
      <Ornament className={newOnes.length ? 'mt-8' : 'mt-2'} />
      <div className="grid sm:grid-cols-2">
        {[mom, me].filter(Boolean).map((m, i) => (
          <div key={m.name} className={`flex items-center gap-4 py-4 ${i > 0 ? 'border-t-[1.5px] border-cobalt sm:border-l-[1.5px] sm:border-t-0 sm:pl-5' : 'sm:pr-5'}`}>
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full border-[3px] border-gold bg-porcelain-glaze">
              <span className={`grid h-10 w-10 place-items-center rounded-full text-xl font-black ${m.role === 'protected' ? 'bg-cobalt text-white' : 'bg-cobalt-tint text-cobalt-deep'}`}>{m.name.slice(0, 1)}</span>
            </div>
            <div className="min-w-0">
              <div className="text-[22px] font-black text-ink">{m.name}</div>
              <div className="text-lg text-ink-soft">{m.city} · {m.role === 'protected' ? t.protected : t.guardian}</div>
            </div>
          </div>
        ))}
        {!data && !error && <div className="h-[88px] animate-pulse bg-porcelain-deep sm:col-span-2" />}
      </div>
      <Ornament />

      {error && !data && (
        <div role="alert" className="mt-6 flex items-center gap-3 rounded-xl border-2 border-risk-scam bg-risk-scamTint p-5 text-lg font-bold text-risk-scam">
          <AlertIcon className="h-6 w-6" /> {t.error}
        </div>
      )}

      {/* Старые — спокойно, но полностью видимо */}
      <Reveal>
      <h2 className="mt-8 text-[26px] font-black text-cobalt-deep">{t.alerts}</h2>
      {data && alerts.length === 0 && (
        <div className="mt-3 border-y-2 border-cobalt py-8 text-center">
          <CheckIcon className="mx-auto h-10 w-10 text-risk-safe" />
          <div className="mt-2 text-[22px] font-black">{t.noAlerts}</div>
          <div className="text-lg text-ink-soft">{t.noAlertsSub}</div>
        </div>
      )}
      {oldOnes.length > 0 && (
        <ul className="mt-3 border-y-2 border-cobalt">
          {oldOnes.map((a, i) => {
            const isSos = a.type === 'sos'
            return (
              <li key={a.id} className={`flex items-start gap-4 py-4 ${i > 0 ? 'border-t-[1.5px] border-cobalt' : ''}`}>
                <span className="mt-0.5 grid h-12 w-12 shrink-0 place-items-center rounded-full border-[3px] border-gold bg-porcelain-glaze text-lg font-black tabular-nums text-cobalt-deep">
                  {isSos ? 'SOS' : a.risk_score}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-xl font-black text-ink">{a.member_name} <span className="font-semibold text-ink-soft">{isSos ? t.sosAlert : t.checkAlert}</span></div>
                  {!isSos && <div className="text-lg font-bold text-cobalt-deep">{scheme(a)}</div>}
                  <p className="mt-0.5 line-clamp-2 text-lg text-ink">«{a.text_preview}»</p>
                  <div className="mt-1 flex items-center gap-3 text-lg text-ink-soft">
                    <span>{timeAgo(a.created_at, t)}</span>
                    <span className="ml-auto inline-flex items-center gap-1.5"><CheckIcon className="h-5 w-5 text-cobalt" /> {t.seen}</span>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      </Reveal>
    </div>
  )
}
