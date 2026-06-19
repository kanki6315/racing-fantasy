/**
 * Class identity (color + label) keyed by the API's class name. Colors are inlined as hex (rather
 * than Tailwind utilities) because the class comes from data — Tailwind's JIT can't see dynamic
 * class names. Mirrors the design-token palette in index.css.
 */
const META: Record<string, { hex: string; label: string }> = {
  GTP: { hex: '#ff2d2d', label: 'GTP' },
  LMP2: { hex: '#2e7dff', label: 'LMP2' },
  GTDPRO: { hex: '#ffb400', label: 'GTD PRO' },
  'GTD PRO': { hex: '#ffb400', label: 'GTD PRO' },
  GTD: { hex: '#4ade80', label: 'GTD' },
}

export function classMeta(name: string | null | undefined) {
  return META[(name ?? '').toUpperCase()] ?? { hex: '#8a8f98', label: name ?? '—' }
}
