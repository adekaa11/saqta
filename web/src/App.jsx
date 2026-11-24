import { useEffect, useMemo, useState } from 'react'
import { LangCtx, STR } from './i18n'
import Check from './pages/Check.jsx'
import Family from './pages/Family.jsx'
import { resetDemo } from './api'
import { SaqtaMark } from './components/Icons.jsx'
import { Frame } from './components/Ornament.jsx'

function useHashRoute() {
  const get = () => (window.location.hash.replace(/^#\/?/, '').split('?')[0] || 'check')
  const [route, setRoute] = useState(get)
  useEffect(() => {
    const on = () => setRoute(get())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return route
}

export default function App() {
  const route = useHashRoute()
  const [lang, setLangState] = useState(() => {
    try { return localStorage.getItem('saqta_lang') || 'kk' } catch { return 'kk' }
  })
  const setLang = (l) => {
    setLangState(l)
    try { localStorage.setItem('saqta_lang', l) } catch {}
  }
  const ctx = useMemo(() => ({ lang, t: STR[lang], setLang }), [lang])
  const t = STR[lang]

  useEffect(() => { document.documentElement.lang = lang }, [lang])

  const tabs = [
    { id: 'check', label: t.tabCheck },
    { id: 'family', label: t.tabFamily }
  ]

  return (
    <LangCtx.Provider value={ctx}>
      <Frame />
      <div className="flex min-h-screen flex-col bg-porcelain px-[16px] pt-[16px]">
        <header className="sticky top-[16px] z-30 bg-porcelain">
          <div className="mx-auto flex h-[68px] max-w-3xl items-center gap-2 px-2 sm:gap-5 sm:px-3">
            <a href="#/check" className="focus-ring flex items-center gap-2.5 rounded-lg">
              <SaqtaMark className="h-10 w-10" />
              <span className="hidden text-[24px] font-black tracking-tight text-cobalt-deep sm:inline">Saqta</span>
            </a>
            <nav className="ml-auto flex items-center gap-3 sm:gap-6" aria-label="Бөлімдер">
              {tabs.map((tb) => (
                <a
                  key={tb.id}
                  href={`#/${tb.id}`}
                  aria-current={route === tb.id ? 'page' : undefined}
                  className={`focus-ring border-b-[3px] pb-0.5 text-lg font-extrabold transition-colors ${route === tb.id ? 'border-gold text-cobalt-deep' : 'border-transparent text-ink-soft hover:text-cobalt'}`}
                >
                  {tb.label}
                </a>
              ))}
            </nav>
            <div className="flex items-center text-lg font-extrabold" role="group" aria-label="Тіл / Язык">
              {['kk', 'ru'].map((l, i) => (
                <span key={l} className="flex items-center">
                  {i > 0 && <span className="mx-1.5 h-5 w-[1.5px] bg-cobalt" aria-hidden />}
                  <button
                    onClick={() => setLang(l)}
                    aria-pressed={lang === l}
                    className={`focus-ring rounded px-1 ${lang === l ? 'text-cobalt-deep underline decoration-gold decoration-[3px] underline-offset-4' : 'text-ink-soft hover:text-cobalt'}`}
                  >
                    {l === 'kk' ? 'ҚАЗ' : 'РУС'}
                  </button>
                </span>
              ))}
            </div>
          </div>
          {/* двойная линия: кобальт + золото */}
          <div className="h-[2px] bg-cobalt" />
          <div className="mt-[2px] h-[1.5px] bg-gold" />
        </header>

        <main className="flex-1">
          {route === 'family' ? <Family /> : <Check />}
        </main>

        <footer className={`pb-36 pt-4 text-center text-lg text-ink-soft ${/[?&]clean=1/.test(window.location.href) ? "invisible" : ""}`}>
          Демо-деректер ·{' '}
          <button className="underline underline-offset-4 hover:text-cobalt" onClick={async () => { await resetDemo(); location.reload() }}>
            reset
          </button>
        </footer>
      </div>
    </LangCtx.Provider>
  )
}
