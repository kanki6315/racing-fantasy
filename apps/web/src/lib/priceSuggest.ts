/**
 * Price suggestion engine math (ADR-0012). Pure functions — the admin Prices screen owns the
 * state (ranking, pins, knobs) and calls these to turn it into suggested prices.
 *
 * Pipeline: ranking → pinned piecewise power curve → budget fit → rounding.
 * Pins are exact admin-set prices the curve must pass through; the class top/floor anchors are
 * just the default first/last pins. Budget fitting scales the anchors (never the pins) so the
 * expected roster cost hits the target.
 */

export type ClassAnchors = { top: number; floor: number }

/** One class's inputs: row keys ordered best → worst, plus any exact-price pins by key. */
export type ClassCurveInput = {
  orderedKeys: string[]
  anchors: ClassAnchors
  pins: ReadonlyMap<string, number>
}

/**
 * Interpolate a full price ladder through the anchor points. Anchors are: the pin at each pinned
 * rank, plus top/floor for the ends when unpinned. Between consecutive anchors (a, b) the price
 * follows Vb + (Va − Vb)·(1−t)^γ — γ = 1 is linear; γ > 1 drops fast off the leader, bunching
 * the midfield (the usual fantasy shape).
 */
export function curvePrices(input: ClassCurveInput, gamma: number): Map<string, number> {
  const { orderedKeys: keys, anchors, pins } = input
  const out = new Map<string, number>()
  const n = keys.length
  if (n === 0) return out
  if (n === 1) {
    out.set(keys[0], pins.get(keys[0]) ?? anchors.top)
    return out
  }

  const anchorIdx: number[] = []
  const anchorVal: number[] = []
  const push = (i: number, v: number) => {
    anchorIdx.push(i)
    anchorVal.push(v)
  }
  push(0, pins.get(keys[0]) ?? anchors.top)
  for (let i = 1; i < n - 1; i++) {
    const p = pins.get(keys[i])
    if (p != null) push(i, p)
  }
  push(n - 1, pins.get(keys[n - 1]) ?? anchors.floor)

  for (let s = 0; s < anchorIdx.length - 1; s++) {
    const a = anchorIdx[s]
    const b = anchorIdx[s + 1]
    const va = anchorVal[s]
    const vb = anchorVal[s + 1]
    out.set(keys[a], va)
    for (let i = a + 1; i < b; i++) {
      const t = (i - a) / (b - a)
      out.set(keys[i], vb + (va - vb) * Math.pow(1 - t, gamma))
    }
    out.set(keys[b], vb)
  }
  return out
}

/** Round to the series' price increment (0.5 for a $120M cap, 0.05 for a $1M one). */
export function roundToStep(value: number, step: number): number {
  const r = Math.round(value / step) * step
  // steps are decimal (0.05, 0.25…) — snap away float dust so the input shows "0.35", not "0.35000000000000003"
  return Number(r.toFixed(4))
}

/** Default rounding step from cap magnitude: ≈ cap/200 snapped to a conventional increment. */
export function defaultStep(salaryCap: number): number {
  const raw = salaryCap / 200
  const steps = [0.05, 0.1, 0.25, 0.5, 1]
  for (const s of steps) if (raw <= s * 1.5) return s
  return 1
}

export type ClassBudgetInput = ClassCurveInput & { slots: number }

/**
 * Expected cost of an "average roster" — per class, slots × mean suggested price — for the
 * drift indicator and budget fitting.
 */
export function expectedRosterCost(classes: ClassBudgetInput[], gamma: number): number {
  let total = 0
  for (const c of classes) {
    if (c.orderedKeys.length === 0 || c.slots === 0) continue
    const prices = [...curvePrices(c, gamma).values()]
    total += (c.slots * prices.reduce((a, b) => a + b, 0)) / prices.length
  }
  return total
}

/**
 * Scale every class's (unpinned) anchors by one factor k so the expected roster cost hits the
 * target. Pins are absolute and never move — with pins present the relationship isn't linear in
 * k, so solve by bisection. Returns the scaled anchors per class (pins untouched).
 */
export function fitAnchorsToBudget(
  classes: ClassBudgetInput[],
  gamma: number,
  targetCost: number,
): Map<ClassBudgetInput, ClassAnchors> {
  const scaled = (k: number) =>
    classes.map((c) => ({ ...c, anchors: { top: c.anchors.top * k, floor: c.anchors.floor * k } }))
  let lo = 0.02
  let hi = 50
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    if (expectedRosterCost(scaled(mid), gamma) < targetCost) lo = mid
    else hi = mid
  }
  const k = (lo + hi) / 2
  const out = new Map<ClassBudgetInput, ClassAnchors>()
  for (const c of classes) out.set(c, { top: c.anchors.top * k, floor: c.anchors.floor * k })
  return out
}

/**
 * Seed a class's ranking, best guess first: previous-round price (desc), then current price
 * (desc), then the given (entry-list) order. Mid-season first rounds fall through to entry order
 * — that's exactly when the admin ranks by hand (or imports points standings).
 */
export function seedRanking(
  keys: string[],
  prevPrice: (key: string) => number | null,
  currentPrice: (key: string) => number | null,
): string[] {
  return keys
    .map((k, i) => ({ k, i, prev: prevPrice(k), cur: currentPrice(k) }))
    .sort((a, b) => (b.prev ?? -1) - (a.prev ?? -1) || (b.cur ?? -1) - (a.cur ?? -1) || a.i - b.i)
    .map((x) => x.k)
}

/** Default anchors when nothing is known: shaped around the per-slot mean the target implies. */
export function defaultAnchors(targetCost: number, totalSlots: number): ClassAnchors {
  const mean = totalSlots > 0 ? targetCost / totalSlots : targetCost
  return { top: mean * 1.8, floor: mean * 0.45 }
}
