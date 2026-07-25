import * as Dialog from '@radix-ui/react-dialog'

const PARAGRAPHS = [
  'I spent 10 years post-college-graduation working as a Software Engineer in AdTech and FinTech (mainly Backend Java) before I quit to focus on broadcasting.',
  'I’ve worked with AI in those last few years and saw it get increasingly competent. But it still requires assistance to get things right.',
  'I had begun writing the API by hand but ended up using that as a baseline for AI to base its patterns around. Several decisions (such as how to collect minimal data from users) require a human to ensure that the “correct” choice is made without sycophantic flattery.',
  'I am a terrible front-end developer, and that is where AI has been most transformative in enabling me to bring this to life quickly.',
  'All hosting decisions and setup were performed by hand.',
]

/** Footer "help from AI" link rendered as a dismissible modal with a scrollable body. */
export function AiPolicyModal({ triggerClassName }: { triggerClassName?: string }) {
  return (
    <Dialog.Root>
      <Dialog.Trigger className={triggerClassName}>help from AI</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[rgba(4,5,6,0.78)] backdrop-blur-[3px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[80vh] w-[560px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[6px] border border-line-2 bg-surface-3 shadow-[0_30px_80px_rgba(0,0,0,0.6)] focus:outline-none">
          <div className="h-1 flex-none bg-gradient-to-r from-brand to-brand-3" />
          <div className="flex flex-none items-start justify-between border-b border-line px-7 pb-[18px] pt-[22px]">
            <div>
              <Dialog.Title className="font-display text-[24px] font-extrabold uppercase leading-[0.96] text-ink">
                AI Policy
              </Dialog.Title>
              <Dialog.Description className="mt-[7px] font-mono text-[11px] tracking-[0.1em] uppercase text-muted">
                Last updated June 19, 2026
              </Dialog.Description>
            </div>
            <Dialog.Close aria-label="Close" className="ml-3.5 flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[3px] border border-line-2 cursor-pointer">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8a8f98" strokeWidth="2.2" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </Dialog.Close>
          </div>

          <div className="flex flex-col gap-4 overflow-y-auto px-7 py-[22px]">
            {PARAGRAPHS.map((p, i) => (
              <p key={i} className="font-sans text-[13px] leading-[1.7] text-muted">
                {p}
              </p>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
