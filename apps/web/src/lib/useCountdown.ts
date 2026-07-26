import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'

/**
 * The current time as render-safe state, refreshed every `stepMs`.
 *
 * `Date.now()` read during render is impure — the value can't be depended on and won't update when
 * the moment it describes passes. This holds it in state instead, so a view that asks "is this
 * locked yet?" gets an answer that becomes true on its own.
 *
 * Pick the step from what's on screen: a visible countdown needs 1000, a lock badge that only has to
 * flip within the minute should say 60000 rather than re-rendering sixty times to change nothing.
 */
export function useNow(stepMs: number): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), stepMs)
    return () => clearInterval(t)
  }, [stepMs])
  return now
}

/**
 * Whether the lock moment has passed — a boolean that re-renders its caller only when it *flips*.
 *
 * `useCountdown` re-renders every second by design; it has a ticking string to show. A caller that
 * only needs "locked or not" was paying that cost for its whole subtree: on the pick screen the
 * countdown drove a ~1,250-node reconcile once a second in order to change one text node, for the
 * hours a player might leave the board open before a lock.
 *
 * `useSyncExternalStore` compares snapshots with `Object.is`, so the interval still fires each
 * second but React only re-renders on the false → true transition. Pair it with a leaf component
 * that owns `useCountdown` for the visible ticking text, and the per-second work stays in the leaf.
 */
export function useIsLocked(target: string | undefined): boolean {
  const at = target ? new Date(target).getTime() : null
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (at === null) return () => {}
      const id = setInterval(onChange, 1000)
      return () => clearInterval(id)
    },
    [at],
  )
  return useSyncExternalStore(subscribe, () => at !== null && Date.now() >= at)
}

/** Client-side lock countdown from the round's quali_start (ADR-0002). Server stays authoritative. */
export function useCountdown(target: string | undefined) {
  const now = useNow(1000)

  if (!target) return { locked: false, text: '—' }
  const ms = new Date(target).getTime() - now
  if (ms <= 0) return { locked: true, text: 'LOCKED' }

  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return { locked: false, text: d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m ${sec}s` }
}
