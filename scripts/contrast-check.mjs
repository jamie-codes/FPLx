// UIX-01 audit fix: WCAG 2.1 relative-luminance contrast checker (throwaway verifier).
function hex(h) {
  const m = h.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(m.slice(i, i + 2), 16))
}
function composite(fgRgb, alpha, bgRgb) {
  return fgRgb.map((c, i) => Math.round(c * alpha + bgRgb[i] * (1 - alpha)))
}
function lum([r, g, b]) {
  const f = (c) => {
    c /= 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
function ratio(a, b) {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (l1 + 0.05) / (l2 + 0.05)
}
const fmt = (n) => (Math.round(n * 100) / 100).toFixed(2)

// Light theme primitives (post-fix)
const L = {
  surface0: hex('#f8fafc'), surface1: hex('#ffffff'), surface2: hex('#eef1f5'),
  ink: hex('#1a1f29'), inkMuted: hex('#5d6779'),
  accent: hex('#1d4ed8'), accentHover: hex('#1e40af'),
  positive: hex('#166534'), warning: hex('#92600a'), negative: hex('#b91c1c'),
  negativeHover: hex('#991b1b'), onAccent: hex('#ffffff'),
  accentSoft: composite(hex('#1d4ed8'), 0.10, hex('#ffffff')),
  positiveSoft: composite(hex('#16a34a'), 0.12, hex('#ffffff')),
  warningSoft: composite(hex('#d97706'), 0.14, hex('#ffffff')),
  negativeSoft: composite(hex('#dc2626'), 0.12, hex('#ffffff')),
}
// Dark theme primitives (unchanged hues; surfaces unchanged)
const D = {
  surface0: hex('#0f1115'), surface1: hex('#171a21'), surface2: hex('#1e232d'),
  ink: hex('#e7e9ee'), inkMuted: hex('#8a93a6'),
  accent: hex('#5b8cff'), accentHover: hex('#6f9aff'),
  positive: hex('#4ade80'), warning: hex('#fbbf24'), negative: hex('#f87171'),
  negativeHover: hex('#fa8a8a'), onAccent: hex('#0f1115'),
  accentSoft: composite(hex('#5b8cff'), 0.14, hex('#171a21')),
  positiveSoft: composite(hex('#4ade80'), 0.14, hex('#171a21')),
  warningSoft: composite(hex('#fbbf24'), 0.16, hex('#171a21')),
  negativeSoft: composite(hex('#f87171'), 0.14, hex('#171a21')),
}

const rows = [
  // [label, fg, bg, threshold]
  ['L ink-muted / surface-0', L.inkMuted, L.surface0, 4.5],
  ['L ink-muted / surface-1', L.inkMuted, L.surface1, 4.5],
  ['L ink-muted / surface-2', L.inkMuted, L.surface2, 4.5],
  ['L ink / surface-1', L.ink, L.surface1, 4.5],
  ['L accent / surface-1', L.accent, L.surface1, 4.5],
  ['L accent / accent-soft∘surface-1', L.accent, L.accentSoft, 4.5],
  ['L on-accent / accent (btn primary)', L.onAccent, L.accent, 4.5],
  ['L on-accent / accent-hover', L.onAccent, L.accentHover, 4.5],
  ['L on-accent / negative (btn danger)', L.onAccent, L.negative, 4.5],
  ['L on-accent / negative-hover', L.onAccent, L.negativeHover, 4.5],
  ['L chip warning / warning-soft∘surface-1', L.warning, L.warningSoft, 4.5],
  ['L chip positive / positive-soft∘surface-1', L.positive, L.positiveSoft, 4.5],
  ['L chip negative / negative-soft∘surface-1', L.negative, L.negativeSoft, 4.5],
  ['L chip accent / accent-soft∘surface-1', L.accent, L.accentSoft, 4.5],
  ['L chip neutral ink-muted / surface-2', L.inkMuted, L.surface2, 4.5],
  ['D ink-muted / surface-0', D.inkMuted, D.surface0, 4.5],
  ['D ink-muted / surface-1', D.inkMuted, D.surface1, 4.5],
  ['D ink-muted / surface-2', D.inkMuted, D.surface2, 4.5],
  ['D ink / surface-1', D.ink, D.surface1, 4.5],
  ['D accent / accent-soft∘surface-1', D.accent, D.accentSoft, 4.5],
  ['D on-accent / accent (btn primary)', D.onAccent, D.accent, 4.5],
  ['D on-accent / accent-hover', D.onAccent, D.accentHover, 4.5],
  ['D on-accent / negative (btn danger)', D.onAccent, D.negative, 4.5],
  ['D on-accent / negative-hover', D.onAccent, D.negativeHover, 4.5],
  ['D chip warning / warning-soft∘surface-1', D.warning, D.warningSoft, 4.5],
  ['D chip positive / positive-soft∘surface-1', D.positive, D.positiveSoft, 4.5],
  ['D chip negative / negative-soft∘surface-1', D.negative, D.negativeSoft, 4.5],
  ['D chip accent / accent-soft∘surface-1', D.accent, D.accentSoft, 4.5],
]

let fail = 0
for (const [label, fg, bg, min] of rows) {
  const r = ratio(fg, bg)
  const ok = r >= min
  if (!ok) fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${fmt(r).padStart(5)}  (min ${min})  ${label}`)
}
process.exit(fail ? 1 : 0)
