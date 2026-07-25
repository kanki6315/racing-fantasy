import { useCallback, useSyncExternalStore } from 'react'

/**
 * Whether a CSS media query currently matches, as React state.
 *
 * `useSyncExternalStore` rather than the usual `useState` + `useEffect` pair: the match is external
 * state that React should read, not state React owns, so there is no setState-in-an-effect and no
 * window between first render and effect attach where the value can be stale.
 *
 * **Pass rem, not px, for Tailwind breakpoints.** Tailwind v4 defines `sm` as `40rem`; hard-coding
 * `640px` here agrees with it only while the root font size is 16px, and silently disagrees — CSS
 * showing one layout while JS believes the other — for anyone who has changed it.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mq = window.matchMedia(query)
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    },
    [query],
  )
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches)
}

/** Tailwind's `sm` breakpoint, in the same unit Tailwind uses. */
export const SM = '(min-width: 40rem)'
