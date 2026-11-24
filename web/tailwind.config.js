/** @type {import('tailwindcss').Config} */
// Токены — из DESIGN.md. Значения в CSS-переменных (index.css): светлая тема — фарфор, тёмная — кобальтовая ночь.
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['"Golos Text"', 'system-ui', 'sans-serif'] },
      colors: {
        ink: { DEFAULT: v('ink'), soft: v('ink-soft'), mute: v('ink-soft') },
        porcelain: { DEFAULT: v('porcelain'), deep: v('porcelain-deep'), glaze: v('porcelain-glaze'), line: v('cobalt') },
        cobalt: { DEFAULT: v('cobalt'), deep: v('cobalt-deep'), press: v('cobalt-press'), tint: v('cobalt-tint') },
        gold: { DEFAULT: v('gold'), soft: v('gold-soft'), deep: v('gold-deep') },
        risk: {
          scam: v('scam'), scamTint: v('scam-tint'),
          warn: v('warn'), warnTint: v('warn-tint'),
          safe: v('safe'), safeTint: v('safe-tint')
        }
      },
      boxShadow: {
        kese: '0 0 0 6px rgb(var(--gold)), 0 0 0 9px rgb(var(--porcelain)), 0 0 0 10.5px rgb(var(--cobalt)), 0 18px 30px -12px rgb(var(--shadow) / .55)'
      }
    }
  },
  plugins: []
}
