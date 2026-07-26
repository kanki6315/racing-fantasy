import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

/** `?champ=&season=&round=` → a number, when it's actually a number. */
export function param(v: string | null): number | null {
  const n = Number(v)
  return v != null && v !== '' && Number.isInteger(n) ? n : null
}

/** A set of query-string edits. `null` removes the key rather than writing an empty value. */
export type ParamPatch = Record<string, string | number | null>

/**
 * Write the query string, which on the filtered boards *is* the view state.
 *
 * `replace` for values the app resolved on the user's behalf, `push` for ones they picked — so the
 * history stack holds the boards a person actually chose and Back walks back through exactly those,
 * rather than through every default the page settled on along the way.
 *
 * Shared by the standings and stats boards. Both pages solve the same problem — three or four filter
 * levels that have to survive a refresh, a Back press and a copied link — and the moment the second
 * page needed it, keeping a private copy of the setter in each route was how the two would drift
 * apart on history semantics without anyone noticing.
 */
export function useParamWriter() {
  const [, setSearch] = useSearchParams()
  return useCallback(
    (next: ParamPatch, mode: 'push' | 'replace') => {
      setSearch(
        (prev) => {
          const p = new URLSearchParams(prev)
          for (const [k, v] of Object.entries(next)) {
            if (v == null) p.delete(k)
            else p.set(k, String(v))
          }
          return p
        },
        { replace: mode === 'replace' },
      )
    },
    [setSearch],
  )
}
