import { useCallback, useEffect, useState } from 'react'
import { renderShareCard, type ShareCardModel } from '../lib/shareCard'

type Props = {
  /** Null until the page's data has resolved; the button stays out of the DOM until then. */
  model: ShareCardModel | null
  /** `nuttytrain-petit-le-mans` — the variant suffix and extension are added here. */
  fileSlug: string
  className?: string
}

type State = 'idle' | 'working' | 'shared' | 'saved' | 'error'

/**
 * Generates the round share card and hands it to the platform: the native share sheet where files can
 * be shared, a download everywhere else.
 *
 * THE EAGER RENDER IS NOT AN OPTIMISATION. iOS Safari requires `navigator.share()` to be called
 * inside the user gesture and rejects it if the call is reached after an `await`. Rendering takes
 * long enough to lose that window, so the blob is drawn as soon as the model settles and parked in
 * state; the click then only has to wrap it in a File. The awaiting path below is the fallback for a
 * click that beats the render — correct everywhere, degraded only on iOS, and reachable only by
 * tapping within a few frames of the page settling.
 */
export function ShareCardButton({ model, fileSlug, className = '' }: Props) {
  // The blob is held in state *paired with the model it was drawn from*, not in a ref. The pairing is
  // what makes staleness impossible to get wrong: when the round changes, the cached blob stops
  // matching and is ignored without anything having to remember to clear it.
  const [ready, setReady] = useState<{ model: ShareCardModel; blob: Blob } | null>(null)
  const [state, setState] = useState<State>('idle')
  const [message, setMessage] = useState('')
  const [renderedFor, setRenderedFor] = useState(model)

  const lineup = model?.variant === 'lineup'
  const noun = lineup ? 'lineup' : 'scorecard'
  const fileName = `endurance-fantasy-${fileSlug}-${noun}.png`
  const cached = ready?.model === model ? ready.blob : null

  // A new model retires any "saved"/"shared" line still on screen. Adjusted during render rather than
  // from an effect, so no frame is ever painted in which the button reports the previous round's
  // outcome next to this round's numbers.
  if (renderedFor !== model) {
    setRenderedFor(model)
    setState('idle')
    setMessage('')
  }

  useEffect(() => {
    if (!model) return
    let cancelled = false
    renderShareCard(model)
      .then((blob) => {
        if (!cancelled) setReady({ model, blob })
      })
      // A pre-render failure is silent: the click path renders again and reports properly there, and
      // an error line for something the player never asked for would be noise.
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [model])

  const deliver = useCallback(
    async (blob: Blob) => {
      const file = new File([blob], fileName, { type: 'image/png' })
      // THE PAYLOAD IS THE FILE AND NOTHING ELSE, and the omission is load-bearing. This used to
      // carry a title and a caption written as the image's alt text — and the share sheet turned
      // that multi-item payload into a pasteboard mess: its Copy row copies every item it was
      // handed, and players pasted the card twice. One File in, one thing for every share-sheet
      // action to operate on. The alt-text duty the caption carried is a real loss; if a target
      // ever grows a caption field worth filling, revisit against the Copy behaviour first.
      const shareData = { files: [file] }
      if (navigator.canShare?.(shareData)) {
        try {
          await navigator.share(shareData)
          setState('shared')
          setMessage(`${noun[0].toUpperCase()}${noun.slice(1)} shared.`)
        } catch (err) {
          // A dismissed share sheet is an AbortError and is not a failure — the player changed their
          // mind. Returning to rest silently is the correct response; an error line would be a lie.
          if ((err as Error)?.name === 'AbortError') setState('idle')
          else throw err
        }
        return
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      a.click()
      URL.revokeObjectURL(url)
      setState('saved')
      // Not the filename. It is 60-odd characters of slug, set in 11px mono, that wraps to three
      // lines and tells the reader nothing they can act on — the file is already in the one place
      // their browser puts files.
      setMessage(`${noun[0].toUpperCase()}${noun.slice(1)} saved to your downloads.`)
    },
    [fileName, noun],
  )

  const onClick = useCallback(() => {
    if (!model) return
    setMessage('')
    const fail = () => {
      setState('error')
      setMessage(`Couldn't build the ${noun}. Try again.`)
    }
    if (cached) {
      // Synchronous entry into `deliver`, so `navigator.share` is still inside the gesture.
      void deliver(cached).catch(fail)
      return
    }
    setState('working')
    renderShareCard(model)
      .then((blob) => {
        setReady({ model, blob })
        return deliver(blob)
      })
      .catch(fail)
  }, [cached, deliver, model, noun])

  if (!model) return null

  const label = lineup ? 'Share Lineup' : 'Share Scorecard'
  const busy = state === 'working'

  return (
    <div className={`flex flex-col items-stretch gap-1.5 sm:items-end ${className}`}>
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        aria-label={`${label} for ${model.teamName} at ${model.roundName}, as an image`}
        className="flex h-[38px] w-full items-center justify-center gap-2 rounded-[3px] border border-line-2 px-[18px] font-display text-[13px] font-semibold uppercase tracking-[0.06em] text-ink-2 transition-colors hover:border-line-3 hover:text-ink disabled:cursor-default disabled:border-line disabled:text-muted pointer-coarse:h-11 sm:w-auto cursor-pointer"
      >
        {/* The share glyph is the label's companion, never its replacement — an icon-only action
            would be the only one in the player UI. */}
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
          <path d="M12 3v13M12 3 7 8M12 3l5 5M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
        </svg>
        {busy ? 'Rendering…' : label}
      </button>
      {/* Mounted at all times rather than inserted with its text — a live region created at the same
          moment it gains content is unreliably announced. */}
      <p
        aria-live="polite"
        className={`font-mono text-[11px] ${state === 'error' ? 'text-danger' : 'text-muted'} ${message ? '' : 'sr-only'}`}
      >
        {message}
      </p>
    </div>
  )
}
