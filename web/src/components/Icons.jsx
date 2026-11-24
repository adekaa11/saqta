// Один набор иконок: штрих 2, скруглённые концы, viewBox 24
const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', viewBox: '0 0 24 24', 'aria-hidden': true }

export const MicIcon = (p) => (
  <svg {...base} {...p}><rect x="9" y="2.5" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3.5M8.5 21.5h7" /></svg>
)
export const PhoneIcon = (p) => (
  <svg {...base} {...p}><path d="M5 3.5h3.2l1.6 4.2-2.1 1.4a11 11 0 0 0 5.2 5.2l1.4-2.1 4.2 1.6V17a2.5 2.5 0 0 1-2.7 2.5A15.5 15.5 0 0 1 2.5 6.2 2.5 2.5 0 0 1 5 3.5Z" /></svg>
)
export const BellIcon = (p) => (
  <svg {...base} {...p}><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16ZM10 20.5a2 2 0 0 0 4 0" /></svg>
)
export const BellOffIcon = (p) => (
  <svg {...base} {...p}><path d="M8.5 5.6A6 6 0 0 1 18 11v4M6 11v5l-1.5 2H17M10 20.5a2 2 0 0 0 4 0M3 3l18 18" /></svg>
)
export const AlertIcon = (p) => (
  <svg {...base} {...p}><path d="M12 3.5 2.5 20h19L12 3.5Z" /><path d="M12 10v4.5M12 17.5v.01" /></svg>
)
export const CheckIcon = (p) => (
  <svg {...base} {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
)
export const ShieldIcon = (p) => (
  <svg {...base} {...p}><path d="M12 2.5 4.5 5.5v6c0 4.7 3.2 8.6 7.5 10 4.3-1.4 7.5-5.3 7.5-10v-6L12 2.5Z" /></svg>
)
export const ArrowRotateIcon = (p) => (
  <svg {...base} {...p}><path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4.5h4.5" /></svg>
)

export const SunIcon = (p) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" /></svg>
)
export const MoonIcon = (p) => (
  <svg {...base} {...p}><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" /></svg>
)

// Знак Saqta: кесе сверху — золотой ободок, кобальтовое дно, белая галочка
export function SaqtaMark({ className = 'h-9 w-9' }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <circle cx="20" cy="20" r="18.5" fill="#fff" />
      <circle cx="20" cy="20" r="17" fill="none" stroke="#B8901E" strokeWidth="3" />
      <circle cx="20" cy="20" r="12.5" fill="#15308C" />
      <path d="m14.5 20.3 3.8 3.8 7.2-7.6" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
