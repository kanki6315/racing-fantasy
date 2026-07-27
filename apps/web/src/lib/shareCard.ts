/**
 * The round share card — a 1080×1350 PNG a player can post to a group chat, drawn on a canvas in the
 * browser from data the standings drill-in already has. No API, no server renderer, no image bucket:
 * the whole feature ships with a `pnpm deploy:web`.
 *
 * WHY IT IS DRAWN AND NOT SCREENSHOTTED. The obvious move is to point html-to-image at the existing
 * DOM, and it is the wrong one here. Those libraries inline computed styles into an SVG foreignObject,
 * which loses Tailwind v4's `@custom-variant` rules, resolves `color-mix()` inconsistently across
 * engines, and needs every webfont re-embedded as base64 — it fails differently in every browser, and
 * the failure is a subtly wrong image rather than an error. Drawing explicitly costs more lines and
 * returns the same pixels everywhere.
 *
 * WHY THERE ARE NO PHOTOS ON IT. Liveries and headshots live behind CloudFront, and reading canvas
 * pixels back after drawing a cross-origin image requires CORS headers the bucket does not send
 * (it is OAC-locked to CloudFront). Rather than gate the feature on an AWS change, the card is built
 * from the things that need no network at all: class colour, condensed caps, and tabular numerals.
 * That lands closer to DESIGN.md's "The Timing Screen" north star than a photo collage would have.
 *
 * THE RED BUDGET. A static image has no primary action and no live state, which are the only two
 * solid-red spends The One Red Rule allows. So the card carries *no* content red at all: the
 * `FANTASY` half of the wordmark and the rule beneath the header are chrome, and the marked row takes
 * the sanctioned tinted wash. A scorecard that glowed red would read as a betting slip — precisely
 * the DraftKings anti-reference PRODUCT.md rules out.
 */

/** Token values mirrored from index.css. Canvas cannot read CSS custom properties, so these are the
 *  one place the palette is duplicated — they must agree with `@theme` and DESIGN.md's frontmatter. */
const C = {
  bg: '#0a0b0d',
  black: '#000000',
  surface2: '#16181c',
  line: '#1f242a',
  line3: '#3a3f47',
  ink: '#ffffff',
  ink2: '#c8ccd2',
  muted: '#8a8f98',
  brand: '#e10600',
  success: '#2dd4bf',
  danger: '#ff689b',
} as const

const DISPLAY = '"Saira Semi Condensed", sans-serif'
const SANS = '"Saira", sans-serif'
const MONO = '"Spline Sans Mono", monospace'

export const CARD_W = 1080
export const CARD_H = 1350

const PAD = 56
const RIGHT = CARD_W - PAD
/** The pit lane's rows start after the class rail column; the label itself lives in the gutter.
 *  Wide enough that "GTD PRO" — the longest class label, three characters past every other — clears
 *  the row's left edge instead of sitting on it. */
const ROW_L = 150
/** Right edge of the figure column. Inset from the page margin so the marked row's tinted box has
 *  padding on the right instead of the number sitting on its border — the box runs to `RIGHT`, and
 *  the row's left padding is already 44px, so a 0px right padding read as a misprint. Every row's
 *  figure uses it, marked or not, so the column stays aligned to the digit. */
const FIG_R = RIGHT - 20
/** Divider under the header. The spend line is scorecard-only, so the band grows only when it is
 *  there rather than reserving a dead 32px strip on every lineup card. */
const headerBottom = (hasSpend: boolean) => (hasSpend ? 392 : 360)
const FOOTER_TOP = 1186

export type ShareCardVariant = 'lineup' | 'scorecard'

export type ShareCardPick = {
  classLabel: string
  classHex: string
  name: string
  drivers: string[]
  /** Right-hand figure: points once scored, price before. Pre-formatted by the caller so the card
   *  and the page beneath it can never print the same value in two dialects. */
  figure: string
  /** What the pick cost, under its points — scorecard only, where `figure` is points rather than
   *  price. Null on a lineup card, whose figure already IS the price. */
  price: string | null
  /** `QUALI +48.0   RACE +364.0` — scorecard only. Spelled out, not the app's `Q`/`R`: see
   *  `sourceLabelLong`. */
  breakdown: string | null
  /** Marks on the row: the bonus applied (`2× POINTS`, `CAPTAIN`) and/or `TOP` for the best pick. */
  chips: { text: string; tone: 'bonus' | 'top' }[]
  /** The pick this card is *about* — the modifier target before the race, the best pick after it. */
  marked: boolean
}

export type ShareCardModel = {
  variant: ShareCardVariant
  championship: string
  roundName: string
  circuit: string | null
  teamName: string
  /** `1196.0` / `$34.5M` */
  heroValue: string
  /** `PTS` / `OF $35.0M` */
  heroUnit: string
  /** `$34.5M OF $35.0M CAP` — the budget the result was bought with. Scorecard only: a lineup card
   *  already spends its hero on exactly this figure, so repeating it there would say it twice. */
  spend: string | null
  stageLabel: string
  stageHex: string
  picks: ShareCardPick[]
  bonuses: { label: string; target: string | null; points: string | null }[]
  roundRank: { rank: number; of: number } | null
  seasonRank: { rank: number; movement: number | null } | null
  siteUrl: string
}

/* ---------------------------------------------------------------- drawing helpers */

type Ctx = CanvasRenderingContext2D

const display = (size: number, weight = 800) => `${weight} ${size}px ${DISPLAY}`
const sans = (size: number, weight = 400) => `${weight} ${size}px ${SANS}`
const mono = (size: number, weight = 500) => `${weight} ${size}px ${MONO}`

/**
 * Tracking in px for a given size, from DESIGN.md's label spec (+0.08em).
 *
 * Canvas takes `letterSpacing` in absolute units, so every call site used to carry a hand-picked px
 * value — which is a ratio that silently changes with the font size. The header label sat at 3px,
 * which is 0.136em at 22px (nearly double spec) and 0.19em once the size ladder stepped it down to
 * 16px, where the tracking was visibly wider than the counters. Deriving it from the size keeps one
 * ratio at every step and matches the token the rest of the app uses.
 */
const track = (size: number, em = 0.08) => size * em

/**
 * `ctx.letterSpacing` is the only way to track canvas text and is missing on older Safari. Tracking
 * is a refinement here, never load-bearing, so an engine without it simply draws at 0 — set through
 * one helper so no call site has to remember the guard.
 */
function withTracking(ctx: Ctx, px: number, draw: () => void) {
  const supported = 'letterSpacing' in ctx
  if (supported) ctx.letterSpacing = `${px}px`
  draw()
  if (supported) ctx.letterSpacing = '0px'
}

function text(
  ctx: Ctx,
  value: string,
  x: number,
  baseline: number,
  o: { font: string; fill: string; align?: CanvasTextAlign; tracking?: number } ,
) {
  ctx.font = o.font
  ctx.fillStyle = o.fill
  ctx.textAlign = o.align ?? 'left'
  withTracking(ctx, o.tracking ?? 0, () => ctx.fillText(value, x, baseline))
  ctx.textAlign = 'left'
}

/**
 * Truncate to fit, with a real ellipsis. Team and entrant names are user/catalog data of any length.
 *
 * Tracking is part of the width and must be passed in. Measuring without it under-reports by a pixel
 * per character, which on the header's 68-character championship line came to ~165px — the string
 * measured as fitting and then ran off the edge of the canvas, clipped rather than ellipsised, with
 * no error anywhere. Canvas will happily draw past its own bounds.
 */
function fit(ctx: Ctx, value: string, font: string, maxWidth: number, tracking = 0): string {
  if (measure(ctx, value, font, tracking) <= maxWidth) return value
  let lo = 0
  let hi = value.length
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (measure(ctx, `${value.slice(0, mid).trimEnd()}…`, font, tracking) <= maxWidth) lo = mid
    else hi = mid - 1
  }
  return `${value.slice(0, lo).trimEnd()}…`
}

/**
 * Shrink through a ladder of sizes before resorting to an ellipsis, and return the size that won.
 * A team name is chosen by its owner and is the card's subject — "THE VERY LONG TE…" is a worse
 * outcome than the same name set two steps smaller. Only a string that overflows even the floor gets
 * cut. The same applies to the class label, where "GTD PRO" is three characters longer than every
 * other label and is the only one that has to shrink to clear the gutter.
 */
function fitStepped(
  ctx: Ctx,
  value: string,
  sizes: number[],
  make: (size: number) => string,
  maxWidth: number,
  em = 0,
): { value: string; font: string; tracking: number } {
  for (const size of sizes) {
    const font = make(size)
    const tracking = track(size, em)
    if (measure(ctx, value, font, tracking) <= maxWidth) return { value, font, tracking }
  }
  const size = sizes[sizes.length - 1]
  const font = make(size)
  const tracking = track(size, em)
  return { value: fit(ctx, value, font, maxWidth, tracking), font, tracking }
}

function measure(ctx: Ctx, value: string, font: string, tracking = 0): number {
  ctx.font = font
  let w = 0
  withTracking(ctx, tracking, () => {
    w = ctx.measureText(value).width
  })
  return w
}

/** The Broadcast Slash — a skewX(-14deg) parallelogram. `tan(14°) ≈ 0.2493`. */
function slash(ctx: Ctx, x: number, y: number, w: number, h: number, fill: string) {
  const dx = h * 0.2493
  ctx.fillStyle = fill
  ctx.beginPath()
  ctx.moveTo(x + dx, y)
  ctx.lineTo(x + dx + w, y)
  ctx.lineTo(x + w, y + h)
  ctx.lineTo(x, y + h)
  ctx.closePath()
  ctx.fill()
}

function hairline(ctx: Ctx, x1: number, x2: number, y: number, fill = C.line) {
  ctx.fillStyle = fill
  ctx.fillRect(x1, y, x2 - x1, 2)
}

/** `#rrggbb` at an alpha, since canvas has no `color-mix()`. */
function alpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

/** A movement arrow drawn as a path — Spline Sans Mono has no guaranteed ▲/▼ glyph, and a missing
 *  one renders as tofu in the middle of the card's only piece of season context. */
function arrow(ctx: Ctx, x: number, y: number, size: number, up: boolean, fill: string) {
  ctx.fillStyle = fill
  ctx.beginPath()
  if (up) {
    ctx.moveTo(x + size / 2, y)
    ctx.lineTo(x + size, y + size)
    ctx.lineTo(x, y + size)
  } else {
    ctx.moveTo(x, y)
    ctx.lineTo(x + size, y)
    ctx.lineTo(x + size / 2, y + size)
  }
  ctx.closePath()
  ctx.fill()
}

const CHIP_FONT = mono(19, 700)

/** Drawn width of a chip, so callers can test whether one fits before committing to it. */
function chipWidth(ctx: Ctx, label: string): number {
  return measure(ctx, label, CHIP_FONT, track(19)) + 20
}

function chip(ctx: Ctx, x: number, y: number, label: string, tone: 'bonus' | 'top'): number {
  // Bonus chips are teal (The Confirmed-Is-Teal Rule — a modifier the player chose and which paid
  // out is a confirmed state). TOP is not a chosen state but a results fact, so it takes the Flag
  // White that DESIGN.md reserves for results-posted, rather than a fifth invented hue.
  const hue = tone === 'bonus' ? C.success : C.ink
  const font = CHIP_FONT
  const w = chipWidth(ctx, label)
  const h = 30
  ctx.fillStyle = alpha(hue, 0.15)
  ctx.strokeStyle = alpha(hue, 0.45)
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, 3)
  ctx.fill()
  ctx.stroke()
  text(ctx, label, x + 10, y + 21, { font, fill: hue, tracking: track(19) })
  return w
}

/* ---------------------------------------------------------------- bands */

function drawHeader(ctx: Ctx, m: ShareCardModel) {
  // The nav's own language: a pure-black bar closed by a brand rule (the broadcast lower-third edge).
  ctx.fillStyle = C.black
  ctx.fillRect(0, 0, CARD_W, 136)
  ctx.fillStyle = C.brand
  ctx.fillRect(0, 136, CARD_W, 4)

  // The wordmark is the colour break, set solid with no space between the halves.
  const wm = display(46, 800)
  text(ctx, 'ENDURANCE', PAD, 90, { font: wm, fill: C.ink, tracking: -1 })
  const endW = measure(ctx, 'ENDURANCE', wm, -1)
  text(ctx, 'FANTASY', PAD + endW, 90, { font: wm, fill: C.brand, tracking: -1 })

  // The hero figure claims the right edge first, so the team name knows how much room is left. Both
  // sit on one baseline: the card's subject and its result, read as a single line.
  //
  // That baseline moved from 272 to 288, and the label above it from 198 to 190. The gap between the
  // two was being measured from the label's baseline rather than from the hero's cap-top, and an
  // 88px numeral has ~63px of cap above its baseline: the figure's top landed at y≈209 against
  // descenders reaching y≈203. Six pixels, which read as the two lines colliding. It is ~30px now.
  const heroFont = mono(88, 700)
  text(ctx, m.heroValue, RIGHT, 288, { font: heroFont, fill: C.ink, align: 'right' })
  text(ctx, m.heroUnit, RIGHT, 324, { font: mono(20, 500), fill: C.muted, align: 'right', tracking: track(20) })
  const heroW = Math.max(measure(ctx, m.heroValue, heroFont), measure(ctx, m.heroUnit, mono(20, 500), track(20)))

  // "WeatherTech SportsCar Championship · Sahlen's Six Hours of the Glen" is 68 characters; a real
  // championship-plus-round line steps down rather than losing the round name to an ellipsis.
  const label = `${m.championship} · ${m.roundName}`.toUpperCase()
  // The floor is set by the real worst case, not a guess: "WeatherTech SportsCar Championship ·
  // Motul SportsCar Endurance Grand Prix" is 71 characters and needs the 16px step to survive whole.
  const head = fitStepped(ctx, label, [22, 20, 18, 16], (s) => mono(s, 500), CARD_W - PAD * 2, 0.08)
  text(ctx, head.value, PAD, 190, { font: head.font, fill: C.muted, tracking: head.tracking })

  // The ladder runs to 34px. It used to stop at 44, where a 29-character team name — "Bartholomew
  // Racing Collective", nothing exotic — still needed 638px against the 611px the hero figure left
  // it, and got cut to "BARTHOLOMEW RACING COLLE…". The team name is the one element that says whose
  // card this is; truncating it defeats the artifact, and 34px is still 1.6× the body size, so the
  // hierarchy holds long before legibility does.
  const nameMax = RIGHT - heroW - 40 - PAD
  const name = fitStepped(ctx, m.teamName.toUpperCase(), [66, 58, 50, 44, 38, 34], (s) => display(s), nameMax)
  text(ctx, name.value, PAD, 288, { font: name.font, fill: C.ink })

  if (m.circuit) {
    text(ctx, fit(ctx, m.circuit, sans(24), nameMax), PAD, 328, { font: sans(24), fill: C.muted })
  }

  // The budget the result was bought with, on its own line under the circuit.
  //
  // It sits in the left "context" column rather than under the hero, because the right column is
  // already a stack — figure, then unit — and a third entry there would read as part of the score.
  // Mono, because it is data; muted, because the points are the headline and this qualifies them.
  if (m.spend) {
    text(ctx, m.spend, PAD, 360, { font: mono(21, 500), fill: C.muted, tracking: track(21) })
  }

  hairline(ctx, PAD, RIGHT, headerBottom(!!m.spend))
}

function drawPitLane(ctx: Ctx, m: ShareCardModel, top: number, bottom: number) {
  const picks = m.picks
  if (picks.length === 0) return
  const rowH = (bottom - top) / picks.length
  // Composition is admin-configurable per round, so a card holds anywhere from four picks to eight.
  // Past five, the row cannot carry three lines legibly at thumbnail size — the driver lineup is the
  // line that goes, because it is the one a reader can infer from the entrant name.
  const compact = picks.length > 5

  // The class label sits once per contiguous group in the gutter, the way the drill-in's rail does.
  // The colour itself is carried per row by a Broadcast Slash rather than by one continuous bar: a
  // card is read as a thumbnail before it is read at all, and at that size a mark on every row keeps
  // each pick self-identifying, where a rail spanning three rows resolves to a single stripe.
  let i = 0
  while (i < picks.length) {
    let j = i
    while (j + 1 < picks.length && picks[j + 1].classLabel === picks[i].classLabel) j++
    const gTop = top + i * rowH
    // Aligned to the centre of the group's FIRST row, not the centre of the group. Centred on the
    // group, a label for five GTD rows floats beside the third of them with blank gutter above and
    // below — it reads as a row that failed to render rather than as a heading for the run. Sat on
    // the first row it lines up with that row's own slash and name, and still heads the whole group.
    // Deliberately untracked, unlike every other mono micro-label on the card. The gutter is 74px
    // and "GTD PRO" is the longest label in the series; adding the spec's +0.08em costs ~12px, which
    // forces two extra steps down the ladder and lands the label at 15px. In a colour that is also
    // doing wayfinding, legibility beats tracking consistency.
    const big = compact ? 18 : 21
    const cl = fitStepped(ctx, picks[i].classLabel, [big, big - 3, big - 6], (s) => mono(s, 700), ROW_L - PAD - 20)
    text(ctx, cl.value, (PAD + ROW_L - 14) / 2, gTop + rowH / 2 + (compact ? 6 : 8), {
      font: cl.font,
      fill: picks[i].classHex,
      align: 'center',
    })
    i = j + 1
  }

  picks.forEach((p, idx) => {
    const ty = top + idx * rowH

    if (p.marked) {
      // The wash + inset hairline the leaderboard uses to mark the viewer's own row — a tinted spend,
      // which is the form The One Red Rule sanctions, drawn inset so the row gains an edge without
      // shifting a pixel.
      //
      // Lighter here than the board's 14%, and deliberately. That figure was calibrated for a 40px
      // row inside a 65-row table, where it has to survive being scanned past. A card row is 186px
      // tall and there is exactly one marked row on the whole image: at 14% it became a filled red
      // panel occupying a fifth of the card, read as an alert band at thumbnail size, and put the
      // DraftKings look right back on a card built to avoid it. The chips carry the mark; the wash
      // only has to seat it.
      ctx.fillStyle = alpha(C.brand, 0.08)
      ctx.beginPath()
      ctx.roundRect(ROW_L, ty + 6, RIGHT - ROW_L, rowH - 12, 4)
      ctx.fill()
      ctx.strokeStyle = alpha(C.brand, 0.3)
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.roundRect(ROW_L + 1, ty + 7, RIGHT - ROW_L - 2, rowH - 14, 4)
      ctx.stroke()
    }

    const slashH = compact ? 30 : 44
    slash(ctx, ROW_L + 14, ty + (rowH - slashH) / 2, 5, slashH, p.classHex)

    const figureFont = mono(compact ? 34 : 44, 700)
    // The wider of the two stacked figures reserves the column, so a long price can never be run
    // into by the text to its left even when the points value above it is short.
    const priceFont = mono(compact ? 16 : 19, 500)
    const figureW = Math.max(
      measure(ctx, p.figure, figureFont),
      p.price ? measure(ctx, p.price, priceFont, track(compact ? 16 : 19)) : 0,
    )
    const textL = ROW_L + 44
    const textR = FIG_R - figureW - 28
    const maxText = textR - textL

    // Lines are collected first, then centred as a block — a lineup card has no breakdown line, and
    // laying rows out from a fixed top would leave every row on it visibly bottom-light.
    // Chips are right-aligned to the text column's edge and the name's width is reduced to clear
    // them, rather than the chips trailing the name.
    //
    // Trailing worked only while the labels were `2×` and `TOP`. Spelling them out for a reader who
    // has never used the app pushed a typical row to `cx 728 + chip 136 = 864` against a `textR` of
    // 850 — over by 14px, so the fit guard correctly refused to draw them and the marked row lost
    // its marks entirely. Reserving the space up front makes the collision impossible instead of
    // detectable, and a chip column beside the figure column reads as part of the card's grid.
    const chipsW = p.chips.reduce((w, c) => w + chipWidth(ctx, c.text) + 8, 0)
    const nameMax = maxText - (chipsW > 0 ? chipsW + 16 : 0)

    // Same ladder-before-ellipsis rule the team name uses. It matters most on exactly the row that
    // has chips, since that row is the one whose text width was just reduced to make room for them —
    // and it is also the row the card is about, so it is the worst one to truncate.
    const lines: { value: string; font: string; fill: string; lh: number; tracking?: number }[] = []
    // The 28px step exists for the two-chip row specifically: `2× POINTS` + `TOP` reserve ~222px,
    // which leaves a 29-character entrant name about 412px and no way to fit it at 32.
    const nameSizes = compact ? [32, 29, 26] : [40, 36, 32, 28]
    const name = fitStepped(ctx, p.name.toUpperCase(), nameSizes, (s) => display(s, 800), nameMax)
    // Line height stays keyed to the base size, not the chosen one, so a shrunk name doesn't change
    // the row's vertical rhythm relative to its neighbours.
    lines.push({ value: name.value, font: name.font, fill: C.ink, lh: compact ? 34 : 42 })
    if (!compact && p.drivers.length > 0) {
      const d = mono(21, 400)
      lines.push({ value: fit(ctx, p.drivers.join(' · ').toUpperCase(), d, maxText, track(21)), font: d, fill: C.muted, lh: 32, tracking: track(21) })
    }
    if (p.breakdown) {
      const bSize = compact ? 19 : 23
      const b = mono(bSize, 500)
      lines.push({ value: fit(ctx, p.breakdown, b, maxText, track(bSize)), font: b, fill: C.ink2, lh: compact ? 28 : 34, tracking: track(bSize) })
    }

    const blockH = lines.reduce((s, l) => s + l.lh, 0)
    let baseline = ty + (rowH - blockH) / 2 + lines[0].lh * 0.78
    lines.forEach((l, li) => {
      text(ctx, l.value, textL, baseline, { font: l.font, fill: l.fill, tracking: l.tracking })
      if (li === 0 && p.chips.length > 0) {
        // Laid out right-to-left from the column edge, so the last chip lands flush with `textR`
        // however many there are.
        let cx = textR
        for (const c of [...p.chips].reverse()) {
          cx -= chipWidth(ctx, c.text)
          chip(ctx, cx, baseline - (compact ? 24 : 28), c.text, c.tone)
          cx -= 8
        }
      }
      baseline += lines[li + 1]?.lh ?? 0
    })

    // The slot under the figure holds the pick's price, not a `PTS` caption. Eight stacked `PTS`
    // labels were the same word repeated under every row of a column that has one heading; a price
    // is different data on every row, and it is the other half of the game — a salary-cap league is
    // played on points per dollar, so a scorecard that shows only points describes half the decision.
    const figY = ty + rowH / 2 + (compact ? 11 : 15) - (p.price ? (compact ? 8 : 10) : 0)
    text(ctx, p.figure, FIG_R, figY, { font: figureFont, fill: C.ink, align: 'right' })
    if (p.price) {
      text(ctx, p.price, FIG_R, figY + (compact ? 22 : 28), {
        font: priceFont,
        fill: C.muted,
        align: 'right',
        tracking: track(compact ? 16 : 19),
      })
    }

    if (idx < picks.length - 1) hairline(ctx, ROW_L, RIGHT, ty + rowH - 1)
  })
}

function drawBonuses(ctx: Ctx, m: ShareCardModel, top: number) {
  hairline(ctx, PAD, RIGHT, top)
  m.bonuses.forEach((b, i) => {
    const y = top + 16 + i * 62
    // The bolt, teal — a modifier the player chose is a confirmed state, and gold here would be
    // GTD PRO's own hue spent on something that is not a class (The Class-Color Reserve).
    ctx.fillStyle = C.success
    ctx.beginPath()
    const bx = PAD
    const by = y + 14
    const s = 30
    ctx.moveTo(bx + s * 0.54, by)
    ctx.lineTo(bx + s * 0.12, by + s * 0.5)
    ctx.lineTo(bx + s * 0.42, by + s * 0.5)
    ctx.lineTo(bx + s * 0.38, by + s)
    ctx.lineTo(bx + s * 0.86, by + s * 0.44)
    ctx.lineTo(bx + s * 0.54, by + s * 0.44)
    ctx.closePath()
    ctx.fill()

    const pointsW = b.points ? measure(ctx, b.points, mono(30, 700)) + 24 : 0
    const labelFont = display(28, 700)
    let x = PAD + 46
    const label = fit(ctx, b.label.toUpperCase(), labelFont, RIGHT - x - pointsW, 1)
    text(ctx, label, x, y + 38, { font: labelFont, fill: C.ink, tracking: 1 })
    x += measure(ctx, label, labelFont, 1) + 14
    if (b.target) {
      text(ctx, fit(ctx, b.target, sans(23), RIGHT - x - pointsW), x, y + 38, { font: sans(23), fill: C.muted })
    }
    if (b.points) {
      text(ctx, b.points, RIGHT, y + 40, { font: mono(30, 700), fill: C.success, align: 'right' })
    }
  })
}

function drawFooter(ctx: Ctx, m: ShareCardModel) {
  hairline(ctx, PAD, RIGHT, FOOTER_TOP)

  // Stage pill — the same words the page beneath it uses, from the same derivation.
  const pillFont = mono(20, 700)
  const pw = measure(ctx, m.stageLabel, pillFont, track(20)) + 54
  ctx.fillStyle = alpha(m.stageHex, 0.12)
  ctx.strokeStyle = alpha(m.stageHex, 0.4)
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.roundRect(PAD, 1212, pw, 44, 3)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = m.stageHex
  ctx.beginPath()
  ctx.arc(PAD + 22, 1234, 6, 0, Math.PI * 2)
  ctx.fill()
  text(ctx, m.stageLabel, PAD + 38, 1241, { font: pillFont, fill: m.stageHex, tracking: track(20) })

  text(ctx, m.siteUrl, PAD, 1316, { font: mono(21, 500), fill: C.muted, tracking: track(21) })

  // Season context, right-aligned so the two figures stack into a column rather than a sentence.
  //
  // SEASON SITS ABOVE ROUND, and the order is the whole point. Read top-down the card used to close
  // on season movement, which meant a player who had just *won* a round got a rose ▼19 as the last
  // thing on their own bragging artifact. The two facts don't actually contradict — one is this
  // round, the other is the campaign, and the labels say so — but peak-end decides how an image
  // feels, and the round result is what the card is about. So the round line goes last and in ink.
  // Nothing was removed to achieve this; the same two figures are simply read in the other order.
  const seasonRow = m.roundRank ? 1242 : 1246
  if (m.seasonRank) {
    let x = RIGHT
    const mv = m.seasonRank.movement
    if (mv != null && mv !== 0) {
      // Colour is never the only signal: the arrow shape carries the direction on its own.
      const tone = mv > 0 ? C.success : C.danger
      const n = String(Math.abs(mv))
      text(ctx, n, x, seasonRow, { font: mono(24, 700), fill: tone, align: 'right' })
      x -= measure(ctx, n, mono(24, 700)) + 22
      arrow(ctx, x, seasonRow - 18, 16, mv > 0, tone)
      x -= 10
    }
    const label = `P${m.seasonRank.rank} OVERALL`
    text(ctx, label, x, seasonRow, { font: mono(22, 500), fill: C.ink2, align: 'right', tracking: track(22) })
  }
  if (m.roundRank) {
    const rank = `P${m.roundRank.rank}`
    const rest = ` / ${m.roundRank.of} THIS ROUND`
    const restW = measure(ctx, rest, mono(21, 500), track(21))
    text(ctx, rest, RIGHT, 1292, { font: mono(21, 500), fill: C.muted, align: 'right', tracking: track(21) })
    text(ctx, rank, RIGHT - restW, 1292, { font: mono(30, 700), fill: C.ink, align: 'right' })
  }
}

/* ---------------------------------------------------------------- entry point */

/**
 * Every family/weight the card draws. Canvas does not trigger font loads and does not wait for them:
 * `fillText` with an unloaded face silently substitutes a system fallback, producing a card that is
 * wrong rather than one that errors. These must be awaited before the first draw.
 */
const FACES = [
  `800 66px ${DISPLAY}`,
  `700 28px ${DISPLAY}`,
  `400 24px ${SANS}`,
  `400 21px ${MONO}`,
  `500 22px ${MONO}`,
  `700 88px ${MONO}`,
]

export async function renderShareCard(model: ShareCardModel): Promise<Blob> {
  if (document.fonts?.load) {
    await Promise.all(FACES.map((f) => document.fonts.load(f).catch(() => undefined)))
  }

  const canvas = document.createElement('canvas')
  canvas.width = CARD_W
  canvas.height = CARD_H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D is unavailable')

  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = C.bg
  ctx.fillRect(0, 0, CARD_W, CARD_H)

  drawHeader(ctx, model)

  const headTop = headerBottom(!!model.spend)
  const bonusH = model.bonuses.length > 0 ? 32 + model.bonuses.length * 62 : 0
  const laneBottom = FOOTER_TOP - bonusH
  if (model.picks.length > 0) {
    drawPitLane(ctx, model, headTop, laneBottom)
  } else {
    text(ctx, 'NO LINEUP SET', CARD_W / 2, (headTop + laneBottom) / 2, {
      font: display(40, 800),
      fill: C.line3,
      align: 'center',
      tracking: 3,
    })
  }
  if (bonusH > 0) drawBonuses(ctx, model, laneBottom)
  drawFooter(ctx, model)

  // A surface-2 hairline frame, so the card keeps an edge against a white chat background — without
  // it the void bleeds into nothing and the image loses its boundary in a light-themed client.
  ctx.strokeStyle = C.surface2
  ctx.lineWidth = 4
  ctx.strokeRect(2, 2, CARD_W - 4, CARD_H - 4)

  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas export failed'))), 'image/png')
  })
}
