// Звуковой дизайн для интро/аутро Saqta — синтез с нуля (никаких чужих сэмплов → нет вопросов к лицензии).
// Звуки привязаны к анимации: кольцо рисуется → свист, кесе появляется → мягкий удар, галочка → колокольчик,
// буквы → щипки струн (как домбра), тезис → тёплый аккорд. Запуск: node sound.mjs intro|outro out.wav
import { writeFileSync } from 'node:fs'

const SR = 48000
const scene = process.argv[2] || 'intro'
const out = process.argv[3] || `${scene}.wav`
const DUR = 6.5
const N = Math.round(SR * DUR)
const L = new Float32Array(N), R = new Float32Array(N)

// детерминированный шум, чтобы звук был одинаковым при каждом запуске
let seed = 12345
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1
const add = (i, l, r = l) => { if (i >= 0 && i < N) { L[i] += l; R[i] += r } }
const note = (n) => 440 * Math.pow(2, (n - 69) / 12) // MIDI → Гц

// Щипок струны (Karplus–Strong): звучит живо, как домбра/гитара
function pluck(t0, midi, amp = 0.35, pan = 0, decay = 0.996) {
  const f = note(midi), p = Math.max(2, Math.round(SR / f))
  const buf = new Float32Array(p).map(() => rnd())
  const s = Math.round(t0 * SR), len = Math.round(2.2 * SR)
  let idx = 0
  for (let k = 0; k < len; k++) {
    const a = buf[idx], b = buf[(idx + 1) % p]
    buf[idx] = decay * 0.5 * (a + b)
    idx = (idx + 1) % p
    const v = a * amp * Math.min(1, k / 30)
    add(s + k, v * (1 - pan) * 0.9, v * (1 + pan) * 0.9)
  }
}
// Колокольчик: несколько обертонов с разным затуханием
function bell(t0, midi, amp = 0.22, pan = 0) {
  const f = note(midi), s = Math.round(t0 * SR), len = Math.round(3.2 * SR)
  const parts = [[1, 1, 1.6], [2.0, 0.45, 1.1], [3.01, 0.22, 0.7], [4.16, 0.12, 0.45], [5.43, 0.06, 0.3]]
  for (let k = 0; k < len; k++) {
    const t = k / SR
    let v = 0
    for (const [m, a, d] of parts) v += a * Math.sin(2 * Math.PI * f * m * t) * Math.exp(-t / d)
    v *= amp * Math.min(1, k / 60)
    add(s + k, v * (1 - pan), v * (1 + pan))
  }
}
// Мягкий низкий удар (кесе ставят на стол)
function thump(t0, amp = 0.55) {
  const s = Math.round(t0 * SR), len = Math.round(0.7 * SR)
  let ph = 0
  for (let k = 0; k < len; k++) {
    const t = k / SR, f = 48 + 70 * Math.exp(-t / 0.05)
    ph += (2 * Math.PI * f) / SR
    const v = Math.sin(ph) * Math.exp(-t / 0.22) * amp * Math.min(1, k / 40)
    add(s + k, v)
  }
}
// Свист/взмах: шум через полосовой фильтр, частота плывёт
function whoosh(t0, dur, f1, f2, amp = 0.18, panFrom = -0.6, panTo = 0.6) {
  const s = Math.round(t0 * SR), len = Math.round(dur * SR)
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0
  for (let k = 0; k < len; k++) {
    const x = k / len
    const fc = f1 * Math.pow(f2 / f1, x), q = 1.4
    const w = (2 * Math.PI * fc) / SR, alpha = Math.sin(w) / (2 * q)
    const a0 = 1 + alpha, a1 = -2 * Math.cos(w), a2 = 1 - alpha
    const inp = rnd()
    const y = (alpha * inp - alpha * x2 - a1 * y1 - a2 * y2) / a0 // полосовой фильтр RBJ, без гула на низах
    x2 = x1; x1 = inp; y2 = y1; y1 = y
    const env = Math.sin(Math.PI * Math.min(1, x)) ** 2
    const v = y * env * amp * 2.2
    const pan = panFrom + (panTo - panFrom) * x
    add(s + k, v * (1 - pan), v * (1 + pan))
  }
}
// Тёплый аккорд-подушка: расстроенные синусы, медленная атака
function pad(t0, dur, midis, amp = 0.07, attack = 0.9) {
  const s = Math.round(t0 * SR), len = Math.round(dur * SR)
  for (const m of midis) {
    for (const det of [-0.08, 0.07]) {
      const f = note(m + det), phL = rnd() * 6, phR = rnd() * 6
      for (let k = 0; k < len; k++) {
        const t = k / SR
        const env = Math.min(1, t / attack) * Math.min(1, (dur - t) / 1.2)
        const sh = 0.75 * Math.sin(2 * Math.PI * f * t) + 0.25 * Math.sin(4 * Math.PI * f * t)
        add(s + k, Math.sin(phL + 2 * Math.PI * f * t) * 0 + sh * amp * env * (det < 0 ? 1.1 : 0.9), sh * amp * env * (det < 0 ? 0.9 : 1.1))
      }
    }
  }
}
// Искристый хвост в начале — цепляет с первой секунды
function shimmer(t0, amp = 0.05) {
  ;[86, 90, 93, 98].forEach((m, i) => bell(t0 + i * 0.035, m, amp, i % 2 ? 0.5 : -0.5))
}

if (scene === 'intro') {
  thump(0.0, 0.6); shimmer(0.02, 0.06); bell(0.02, 74, 0.12)            // удар + искры в первую же секунду
  whoosh(0.15, 1.2, 600, 4500, 0.09)                                     // кольцо рисуется
  thump(0.9, 0.45)                                                       // кесе встаёт
  bell(1.45, 81, 0.2, -0.1); bell(1.47, 86, 0.12, 0.2)                   // галочка
  ;[62, 64, 66, 69, 74].forEach((m, i) => pluck(1.8 + i * 0.08, m, 0.3, -0.4 + i * 0.2)) // буквы S-a-q-t-a
  whoosh(3.05, 0.8, 1500, 5000, 0.05, 0.3, -0.3)                          // золотая линия
  pad(3.4, 3.1, [50, 57, 62, 66, 69], 0.055)                             // тезис: тёплый ре-мажор
  pluck(3.5, 74, 0.18, -0.2); pluck(3.62, 78, 0.16, 0.2); pluck(3.74, 81, 0.14, 0)
  bell(4.4, 86, 0.06, 0.3)                                               // подпись
} else {
  thump(0.0, 0.5); shimmer(0.02, 0.045)
  whoosh(0.1, 1.0, 600, 4000, 0.08)
  pad(0.4, 1.4, [47, 54, 59, 62], 0.05, 0.3)                             // «Алаяққа…» — тревожный си-минор
  pluck(0.5, 59, 0.28, -0.3); pluck(0.62, 62, 0.24, 0.3)
  thump(0.7, 0.35)
  bell(1.15, 81, 0.16)
  pad(1.6, 4.9, [50, 57, 62, 66, 69, 76], 0.055)                         // «…бір отбасы» — разрешение в ре-мажор
  ;[62, 66, 69, 74].forEach((m, i) => pluck(1.65 + i * 0.09, m, 0.26, -0.3 + i * 0.2))
  whoosh(2.95, 0.8, 1500, 5000, 0.05, -0.3, 0.3)
  bell(3.4, 86, 0.08, -0.2); bell(4.0, 81, 0.07, 0.2)                    // ссылки, команда
  bell(5.0, 74, 0.1); bell(5.02, 69, 0.08)                               // финальная точка
}

// Реверберация (простой Шрёдер): склеивает звуки, даёт «дорогое» пространство
function reverb(x, mix = 0.22) {
  const combs = [1557, 1617, 1491, 1422].map((d) => ({ d: Math.round(d * SR / 44100), b: new Float32Array(Math.round(d * SR / 44100)), i: 0, f: 0.84 }))
  const aps = [225, 556, 441].map((d) => ({ d: Math.round(d * SR / 44100), b: new Float32Array(Math.round(d * SR / 44100)), i: 0 }))
  const y = new Float32Array(x.length)
  let lp = 0
  for (let n = 0; n < x.length; n++) {
    let s = 0
    for (const c of combs) { const o = c.b[c.i]; lp = o * 0.7 + lp * 0.3; c.b[c.i] = x[n] + lp * c.f; c.i = (c.i + 1) % c.d; s += o }
    s *= 0.25
    for (const a of aps) { const o = a.b[a.i]; const v = -s + o; a.b[a.i] = s + o * 0.5; a.i = (a.i + 1) % a.d; s = v }
    y[n] = x[n] * (1 - mix) + s * mix
  }
  return y
}
const LL = reverb(L), RR = reverb(R, 0.24)
// Мастер: мягкий лимитер, нормализация до −1 dBFS, плавный конец
let peak = 0
for (let n = 0; n < N; n++) { LL[n] = Math.tanh(LL[n] * 1.2); RR[n] = Math.tanh(RR[n] * 1.2); peak = Math.max(peak, Math.abs(LL[n]), Math.abs(RR[n])) }
const g = 0.89 / peak
const fadeStart = N - Math.round(0.6 * SR)
const pcm = Buffer.alloc(44 + N * 4)
pcm.write('RIFF', 0); pcm.writeUInt32LE(36 + N * 4, 4); pcm.write('WAVE', 8); pcm.write('fmt ', 12)
pcm.writeUInt32LE(16, 16); pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(2, 22); pcm.writeUInt32LE(SR, 24)
pcm.writeUInt32LE(SR * 4, 28); pcm.writeUInt16LE(4, 32); pcm.writeUInt16LE(16, 34); pcm.write('data', 36); pcm.writeUInt32LE(N * 4, 40)
for (let n = 0; n < N; n++) {
  const f = n > fadeStart ? (N - n) / (N - fadeStart) : 1
  pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, LL[n] * g * f)) * 32767), 44 + n * 4)
  pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, RR[n] * g * f)) * 32767), 46 + n * 4)
}
writeFileSync(out, pcm)
console.log('ok', out)
