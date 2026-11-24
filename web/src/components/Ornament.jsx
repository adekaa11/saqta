// Разделитель-роспись: две кобальтовые линии и золотой ромб. Вместо карточек.
export default function Ornament({ children, className = '' }) {
  return (
    <div className={`flex items-center gap-3 ${className}`} aria-hidden={!children}>
      <span className="h-[1.5px] flex-1 bg-cobalt" />
      <span className="h-2.5 w-2.5 rotate-45 border-[1.5px] border-cobalt bg-gold" />
      {children && <span className="text-lg font-semibold text-ink-soft">{children}</span>}
      {children && <span className="h-2.5 w-2.5 rotate-45 border-[1.5px] border-cobalt bg-gold" />}
      <span className="h-[1.5px] flex-1 bg-cobalt" />
    </div>
  )
}

// Бордюр экрана как у блюдца
export function Frame() {
  return (
    <div className="frame" aria-hidden>
      <div className="frame-net net" />
      <div className="frame-gold" />
    </div>
  )
}
