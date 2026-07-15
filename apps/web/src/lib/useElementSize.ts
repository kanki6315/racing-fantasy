import { useCallback, useRef, useState } from 'react'

/** The measured **border-box** size of an element (matches its visual footprint, incl. padding + border).
 * Zeroed until the first observation. */
export type ElementSize = { width: number; height: number }

/**
 * Measure an element's live size with a ResizeObserver. Returns a callback ref to attach to the node
 * and its current border-box size; it updates on every layout change (content, viewport, reflow). Used by
 * the Landing calendar to match the hero panel's full height. (First DOM-measurement hook in the codebase.)
 */
export function useElementSize<T extends HTMLElement = HTMLElement>(): [(node: T | null) => void, ElementSize] {
  const [size, setSize] = useState<ElementSize>({ width: 0, height: 0 })
  const observerRef = useRef<ResizeObserver | null>(null)

  const ref = useCallback((node: T | null) => {
    observerRef.current?.disconnect()
    if (!node) return
    const observer = new ResizeObserver((entries) => {
      const target = entries[0]?.target as HTMLElement | undefined
      if (target) setSize({ width: target.offsetWidth, height: target.offsetHeight }) // border-box
    })
    observer.observe(node)
    observerRef.current = observer
  }, [])

  return [ref, size]
}
