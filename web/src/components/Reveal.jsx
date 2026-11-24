// Анимация появления при прокрутке отключена: блоки показываются сразу.
export default function Reveal({ children, className = '' }) {
  return <div className={className}>{children}</div>
}
