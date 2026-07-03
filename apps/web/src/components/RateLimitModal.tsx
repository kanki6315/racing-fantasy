import * as Dialog from '@radix-ui/react-dialog'

/**
 * Shown when an action is rejected with 429 (e.g. toggling email preferences too fast — the endpoint
 * is capped at 5/min per user). Purely informational: dismiss and try again in a moment.
 */
export function RateLimitModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[rgba(4,5,6,0.78)] backdrop-blur-[3px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[420px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[6px] border border-line-2 bg-surface-3 shadow-[0_30px_80px_rgba(0,0,0,0.6)] focus:outline-none">
          <div className="h-1 bg-gradient-to-r from-brand to-brand-3" />
          <div className="px-7 pb-6 pt-[26px]">
            <div className="font-mono text-[11px] tracking-[0.14em] text-brand mb-[9px]">// EASY_THERE</div>
            <Dialog.Title className="font-display text-[24px] font-extrabold italic uppercase leading-[0.96] text-ink">
              Slow down a sec
            </Dialog.Title>
            <Dialog.Description className="mt-3 font-sans text-[13px] leading-[19px] text-muted">
              You're changing your email preferences too quickly. Give it a minute, then try again — your
              last change didn't stick.
            </Dialog.Description>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="mt-[22px] flex h-[44px] w-full items-center justify-center rounded-[3px] bg-brand cursor-pointer"
            >
              <span className="font-display text-[15px] font-bold italic tracking-[0.05em] uppercase text-ink">Got it</span>
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
