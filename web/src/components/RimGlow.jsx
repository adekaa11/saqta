import { AnimatePresence, motion } from 'framer-motion'

// Плавная красная рамка по краю экрана — сигнал «алаяқтар» / SOS вместо резкой инверсии
export default function RimGlow({ pulse }) {
  return (
    <AnimatePresence>
      {pulse && (
        <motion.div
          key={pulse}
          aria-hidden
          className="pointer-events-none fixed inset-0 z-50"
          style={{ boxShadow: 'inset 0 0 0 6px rgba(194,40,26,.9), inset 0 0 90px 10px rgba(194,40,26,.35)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0.35, 0.9, 0] }}
          exit={{ opacity: 0 }}
          transition={{ duration: 2.2, ease: 'easeOut', times: [0, 0.18, 0.45, 0.62, 1] }}
        />
      )}
    </AnimatePresence>
  )
}
