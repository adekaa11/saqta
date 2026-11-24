import { useEffect, useState } from 'react'
import { useLang } from '../i18n'
import Ornament from '../components/Ornament.jsx'
import { getMetrics } from '../api'

// «Пилот в цифрах»: живые метрики из журнала событий сервера (без текстов сообщений)
const L = {
  kk: {
    title: 'Пилот сандармен', lead: 'Тікелей деректер: Telegram-бот пен сайттағы нақты тексерулер.', since: 'Есеп басталған күн',
    families: 'Отбасы құрылды', elders: 'Ата-ана қосылды', checks: 'Тексеру', alerts: 'Отбасыға дабыл',
    verdicts: 'Нәтижелер', scam: 'Алаяқтар', suspicious: 'Күдікті', safe: 'Қауіпсіз',
    inputs: 'Қалай жіберді', text: 'Мәтін', voice: 'Дауыс', screenshot: 'Скриншот',
    speed: 'Жылдамдық', median: 'Жауап (медиана)', p90: '10 тексерудің 9-ы осыдан жылдам', toAlert: 'Хабарламадан дабылға дейін (медиана)',
    ai: 'ЖИ жауап берді', rules: 'Тек ережелер (ЖИ бос емес)', delivered: 'Дабыл жеткізілді',
    note: 'Хабарлама мәтіндері сақталмайды — тек түрі, нәтижесі және уақыты. Команданың тексерулері пилот басталғанға дейін есептелмейді.',
    sec: 'с', none: 'Әзірге дерек жоқ', err: 'Деректерді жүктеу мүмкін болмады'
  },
  ru: {
    title: 'Пилот в цифрах', lead: 'Живые данные: реальные проверки в Telegram-боте и на сайте.', since: 'Считается с',
    families: 'Семей создано', elders: 'Родителей подключилось', checks: 'Проверок', alerts: 'Тревог семье',
    verdicts: 'Вердикты', scam: 'Мошенники', suspicious: 'Подозрительно', safe: 'Безопасно',
    inputs: 'Как прислали', text: 'Текст', voice: 'Голос', screenshot: 'Скриншот',
    speed: 'Скорость', median: 'Ответ (медиана)', p90: '9 из 10 проверок быстрее', toAlert: 'От сообщения до тревоги (медиана)',
    ai: 'Ответила модель ИИ', rules: 'Только правила (ИИ был занят)', delivered: 'Тревог доставлено',
    note: 'Тексты сообщений не хранятся — только тип, вердикт и время. Тесты команды до старта пилота не учитываются.',
    sec: 'с', none: 'Пока нет данных', err: 'Не удалось загрузить данные'
  }
}

const sec = (ms) => (typeof ms === 'number' ? (ms / 1000).toFixed(1).replace('.', ',') : '—')

function Big({ n, label }) {
  return (
    <div className="py-5">
      <div className="text-[52px] font-black leading-none tabular-nums tracking-tight text-cobalt-deep">{n}</div>
      <div className="mt-2 text-xl font-bold text-ink">{label}</div>
    </div>
  )
}

function Row({ label, value, strong }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t-[1.5px] border-cobalt/25 py-3 first:border-t-0">
      <span className="text-xl text-ink">{label}</span>
      <span className={`text-[24px] tabular-nums ${strong ? 'font-black text-risk-scam' : 'font-black text-cobalt-deep'}`}>{value}</span>
    </div>
  )
}

export default function Stats() {
  const { lang } = useLang()
  const s = L[lang]
  const [m, setM] = useState(null)
  const [err, setErr] = useState(false)

  useEffect(() => {
    const since = new URLSearchParams(window.location.hash.split('?')[1] || '').get('since')
    const load = () => getMetrics(since).then((d) => { setM(d); setErr(false) }).catch(() => setErr(true))
    load()
    const iv = setInterval(load, 15000)
    return () => clearInterval(iv)
  }, [])

  const c = m?.checks
  const a = m?.alerts
  const llm = c ? (c.by_engine.llm || 0) + (c.by_engine['llm+rules'] || 0) : 0

  return (
    <div className="mx-auto max-w-3xl px-3 pb-10 sm:px-6">
      <div className="pb-4 pt-8">
        <h1 className="text-[36px] font-black leading-[1.08] tracking-tight text-cobalt-deep sm:text-[42px]">{s.title}</h1>
        <p className="mt-3 max-w-xl text-xl leading-snug text-ink-soft">{s.lead}</p>
        {m && <p className="mt-2 text-lg font-semibold text-ink-soft">{s.since}: {new Date(m.since).toLocaleDateString(lang === 'kk' ? 'kk-KZ' : 'ru-RU')}</p>}
      </div>
      <Ornament />

      {err && !m && <p role="alert" className="mt-6 text-xl font-bold text-risk-scam">{s.err}</p>}
      {!m && !err && <div className="mt-6 h-40 animate-pulse bg-porcelain-deep" />}

      {m && (
        <>
          <div className="grid grid-cols-2 gap-x-6 sm:grid-cols-4">
            <Big n={m.families_created} label={s.families} />
            <Big n={m.elders_joined} label={s.elders} />
            <Big n={c.total} label={s.checks} />
            <Big n={a.total} label={s.alerts} />
          </div>
          <Ornament />

          {c.total === 0 ? (
            <p className="mt-6 text-xl text-ink-soft">{s.none}</p>
          ) : (
            <div className="mt-6 grid gap-x-10 gap-y-8 sm:grid-cols-2">
              <section>
                <h2 className="mb-2 text-[24px] font-black text-cobalt-deep">{s.verdicts}</h2>
                <Row label={s.scam} value={c.by_verdict.scam || 0} strong />
                <Row label={s.suspicious} value={c.by_verdict.suspicious || 0} />
                <Row label={s.safe} value={c.by_verdict.safe || 0} />
              </section>
              <section>
                <h2 className="mb-2 text-[24px] font-black text-cobalt-deep">{s.inputs}</h2>
                <Row label={s.text} value={c.by_input.text || 0} />
                <Row label={s.voice} value={c.by_input.voice || 0} />
                <Row label={s.screenshot} value={c.by_input.screenshot || 0} />
              </section>
              <section>
                <h2 className="mb-2 text-[24px] font-black text-cobalt-deep">{s.speed}</h2>
                <Row label={s.median} value={`${sec(c.median_ms)} ${s.sec}`} />
                <Row label={s.p90} value={`${sec(c.p90_ms)} ${s.sec}`} />
                <Row label={s.toAlert} value={`${sec(a.median_total_ms)} ${s.sec}`} />
              </section>
              <section>
                <h2 className="mb-2 text-[24px] font-black text-cobalt-deep">ИИ</h2>
                <Row label={s.ai} value={`${Math.round((llm / c.total) * 100)}%`} />
                <Row label={s.rules} value={c.by_engine.rules || 0} />
                <Row label={s.delivered} value={`${a.delivered} / ${a.total}`} />
              </section>
            </div>
          )}
          <p className="mt-10 max-w-2xl text-lg leading-snug text-ink-soft">{s.note}</p>
        </>
      )}
    </div>
  )
}
