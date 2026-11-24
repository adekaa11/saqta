import { useEffect, useState } from 'react'
import { animate, motion } from 'framer-motion'

export const VERDICT_COLOR = { scam: '#C2281A', suspicious: '#8A4E00', safe: '#1B6A3D' }

// Тарелка с золотым ободком: шкала риска идёт по внутреннему кругу
export default function Gauge({ score, verdict, size = 216 }) {
  const [n, setN] = useState(0)
  const color = VERDICT_COLOR[verdict] || 'rgb(var(--cobalt))'

  useEffect(() => {
    const c = animate(0, score, { duration: 1.3, ease: [0.16, 1, 0.3, 1], onUpdate: (v) => setN(Math.round(v)) })
    return () => c.stop()
  }, [score])

  const r = 78
  return (
    <div className="relative mx-auto rounded-full bg-porcelain-glaze shadow-[0_0_0_2px_rgb(var(--porcelain)),0_0_0_3.5px_rgb(var(--cobalt))]" style={{ width: size, height: size }}>
      <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full" role="img" aria-label={`${score} / 100`}>
        <circle cx="100" cy="100" r="96" fill="none" style={{ stroke: 'rgb(var(--gold))' }} strokeWidth="6" />
        <circle cx="100" cy="100" r="91" fill="none" style={{ stroke: 'rgb(var(--cobalt))' }} strokeWidth="1" />
        <circle cx="100" cy="100" r={r} fill="none" style={{ stroke: 'rgb(var(--cobalt-tint))' }} strokeWidth="12" />
        <motion.circle
          cx="100" cy="100" r={r} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
          transform="rotate(-90 100 100)"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: Math.max(0.02, score / 100) }}
          transition={{ duration: 1.3, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <div className="text-[64px] font-black leading-none tabular-nums tracking-tight" style={{ color }}>{n}</div>
          <div className="mt-1 text-lg font-bold text-ink-soft">/ 100</div>
        </div>
      </div>
    </div>
  )
}
