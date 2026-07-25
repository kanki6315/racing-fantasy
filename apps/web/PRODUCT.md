# Product

## Register

product

## Users

Motorsport fans who follow the IMSA sportscar championship and want skin in the game.
They're competent with fantasy-sports mechanics (salary caps, weekly lineups, leagues) and
care about the real series — they know classes (GTP/LMP2/GTD), teams, and drivers.

Two contexts of use:
- **Race-weekend players** building or tweaking a roster under a salary cap before picks lock
  at qualifying, checking prices, lineups, and scores. Often mobile, often time-pressured
  (the lock is a real deadline).
- **Season-long competitors** tracking standings across a season-wide pool plus their
  private/public leagues, returning between rounds to see where they place.

A separate **admin** audience (league operators) runs the catalog, prices, ingestion, and
scoring through a desktop console — a power-user surface, not the player-facing product.

## Product Purpose

Endurance Fantasy lets fans register per championship-season, pick teams and drivers under a
salary cap each round, and score on qualifying + race position (plus free per-round bonus
modifiers). Standings run as a season-wide pool plus user-created leagues.

It exists to make watching IMSA more engaging across a long season — to give every round a
personal stake and a reason to follow the timing screen. Success looks like players returning
every race weekend: building a roster before the lock, then coming back to watch their picks
score and their league position move.

## Brand Personality

Sits between a **live race-broadcast graphics package** and a **premium motorsport marque** —
precise and data-fluent without being a cluttered timing screen; sleek and considered without
going cold or generic. Three words: **precise, fast, premium.**

- **Voice:** confident and economical, like broadcast lower-thirds and timing graphics. Numbers
  speak for themselves. No hype-speak, no betting-app urgency.
- **Numerals matter:** positions, prices, points, and deltas are the content. Treat them as
  first-class typography (the mono stack exists for this) — tabular, legible, scannable at a glance.
- **Emotional goal:** the focus and anticipation of the grid before lights-out, and the
  satisfaction of a clean result. Stakes feel real but the interface stays calm under them.
- **Racing-class identity is load-bearing:** the per-class colors (GTP/LMP2/GTD) are part of the
  brand, not decoration — they orient the user the way class identity does trackside.

## Anti-references

- **Generic SaaS dashboard.** No cream/blue Stripe-clone admin look, no identical icon-heading-text
  card grids, no big-number hero-metric template. This is motorsport, not a B2B tool.
- **DraftKings / betting-app aesthetic.** No loud green-on-black gambling look, no odds-board
  clutter, no aggressive flashing CTAs or manufactured urgency. The lock deadline is real; we don't
  fake urgency on top of it.
- **Cluttered real-world timing software.** No Al-Kamel/timing-screen density-for-its-own-sake.
  Data-dense where it earns it, but always legible and hierarchical, never overwhelming.
- **Toy / cartoonish gamification.** No mascots, no bubbly rounded-everything, no childish
  fantasy-game styling. Premium, not playful.

## Design Principles

- **Numbers are the interface.** Position, price, points, delta — the data is the product. Design
  for scannability and tabular precision; let the figures carry the screen.
- **Broadcast clarity under deadline.** Players act against a hard lock. State must be unmistakable
  at a glance — open vs. locked vs. not-yet-open, cap remaining, what's picked — with no second-guessing.
- **Class color is wayfinding, not decoration.** Use the racing-class palette consistently to orient,
  the way class identity works trackside. Never spend those colors on anything else.
- **Calm under stakes.** Convey anticipation and consequence through hierarchy and restraint, not
  noise. Premium motorsport, not a casino floor.
- **Respect the long season.** This is a returning-user product. Reward fluency and recognition over
  rounds; standings and history should feel like a continuous campaign, not isolated sessions.

## Accessibility & Inclusion

Target **WCAG 2.1 AA**. The codebase already establishes the baseline: a global `:focus-visible`
ring, `prefers-reduced-motion` handling, aria-labels, and semantic headings — keep that bar.

- **Contrast:** the dark broadcast palette must hit AA on body text (≥4.5:1) and large text (≥3:1);
  watch muted-gray-on-dark-surface, the easy failure here.
- **Color is never the only signal:** class identity and status (open/locked, gain/loss) carry color,
  so they must also be distinguished by text, icon, or position for color-blind users.
- **Reduced motion** stays first-class; every animation needs a crossfade/instant fallback.
- **Mobile, deadline-driven:** race-weekend players are often on phones against the clock — touch
  targets, legibility, and responsive table reflow are accessibility, not just polish.
