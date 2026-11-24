import { motion } from 'framer-motion'

export function findAt(text, needle) {
  let at = text.indexOf(needle)
  if (at < 0) at = text.toLowerCase().indexOf(needle.toLowerCase())
  return at
}

// Сортирует улики по порядку появления в тексте, чтобы ①②③ шли по тексту
export function orderFlags(text, flags) {
  return flags
    .map((f) => ({ ...f, at: findAt(text, f.text) }))
    .sort((a, b) => (a.at < 0 ? 1e9 : a.at) - (b.at < 0 ? 1e9 : b.at))
}

export function segment(text, flags) {
  const found = []
  flags.forEach((f, i) => {
    const at = findAt(text, f.text)
    if (at < 0) return
    const end = at + f.text.length
    if (found.some((x) => at < x.end && end > x.start)) return
    found.push({ start: at, end, i })
  })
  found.sort((a, b) => a.start - b.start)
  const parts = []
  let pos = 0
  for (const f of found) {
    if (f.start > pos) parts.push({ s: text.slice(pos, f.start) })
    parts.push({ s: text.slice(f.start, f.end), i: f.i })
    pos = f.end
  }
  if (pos < text.length) parts.push({ s: text.slice(pos) })
  return parts
}

export default function Highlighted({ text, flags, active, onHover, baseDelay = 1.1 }) {
  const parts = segment(text, flags)
  return (
    <p className="text-[21px] leading-[1.75] text-ink">
      {parts.map((p, k) => {
        if (p.i === undefined) return <span key={k}>{p.s}</span>
        const delay = baseDelay + p.i * 0.35
        const on = active === p.i
        return (
          <motion.mark
            key={k}
            onMouseEnter={() => onHover?.(p.i)}
            onMouseLeave={() => onHover?.(null)}
            onClick={() => onHover?.(p.i)}
            initial={{ backgroundColor: 'rgba(194,40,26,0)' }}
            animate={{ backgroundColor: on ? 'rgba(194,40,26,.24)' : 'rgba(194,40,26,.12)' }}
            transition={{ delay: on ? 0 : delay, duration: 0.45 }}
            className="cursor-pointer rounded-md px-1 py-0.5 underline decoration-risk-scam decoration-2 underline-offset-[5px] [box-decoration-break:clone] [-webkit-box-decoration-break:clone]"
          >
            <motion.span
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay, type: 'spring', stiffness: 400, damping: 18 }}
              className="num mr-1.5 h-7 w-7 -translate-y-0.5 bg-risk-scam text-[18px] text-white no-underline"
            >
              {p.i + 1}
            </motion.span>
            {p.s}
          </motion.mark>
        )
      })}
    </p>
  )
}
