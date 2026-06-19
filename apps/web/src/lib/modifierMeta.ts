/**
 * Curated bonus-modifier formats (ADR-0006). A kind belongs here only when it's wired end-to-end —
 * a scorer in the API (ModifierScoring.cs) AND pick-page targeting. The admin picker offers exactly
 * these, and the pick page renders their labels/hints, so the two can't drift.
 */
export type ModifierAppliesTo = 'MainPick' | 'Driver'

export type ModifierFormat = {
  kind: string
  label: string
  hint: string
  appliesTo: ModifierAppliesTo
}

export const MODIFIER_FORMATS: ModifierFormat[] = [
  {
    kind: 'DOUBLE_POINTS_TEAM',
    label: 'Double Points Team',
    hint: 'One of your teams scores double — added as bonus points.',
    appliesTo: 'MainPick',
  },
  {
    kind: 'CAPTAIN',
    label: 'Captain',
    hint: 'Your captain driver scores double.',
    appliesTo: 'Driver',
  },
]

const BY_KIND = new Map(MODIFIER_FORMATS.map((m) => [m.kind, m]))

/** Friendly label/hint for a kind; unknown kinds fall back to their raw key. */
export const modMeta = (kind: string) => BY_KIND.get(kind) ?? { kind, label: kind, hint: '' }
