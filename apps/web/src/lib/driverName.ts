/**
 * How a driver's name is shortened, in one place. The lineup component and the share card both need
 * the surname, and two surfaces splitting "Nicky Catsburg" differently is drift a reader would
 * notice — so this lives in `lib` rather than being exported from the component. (Exporting a plain
 * function from a `.tsx` component file also breaks Fast Refresh, which the lint rule enforces.)
 */

/** Last whitespace-separated token — "Earl Bamber" → "Bamber". */
export const lastName = (full: string) => full.trim().split(/\s+/).slice(-1)[0] ?? full

/** First + last initial, uppercased — "Earl Bamber" → "EB". A single-word name yields one letter. */
export const initials = (full: string) => {
  const parts = full.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? '?'
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase()
}
