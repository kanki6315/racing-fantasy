import * as Dialog from '@radix-ui/react-dialog'

// Placeholder copy until the real policy is written — enough paragraphs to prove the body scrolls.
const LOREM = [
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Praesent euismod, nisl eget consectetur sagittis, nisl nunc consectetur nisi, euismod consectetur nisl nunc euismod nisi. Sed euismod, nisl eget consectetur sagittis, nisl nunc consectetur nisi.',
  'Curabitur pretium tincidunt lacus. Nulla gravida orci a odio. Nullam varius, turpis et commodo pharetra, est eros bibendum elit, nec luctus magna felis sollicitudin mauris. Integer in mauris eu nibh euismod gravida.',
  'Duis ac tellus et risus vulputate vehicula. Donec lobortis risus a elit. Etiam tempor. Ut ullamcorper, ligula eu tempor congue, eros est euismod turpis, id tincidunt sapien risus a quam. Maecenas fermentum consequat mi.',
  'Donec fermentum. Pellentesque malesuada nulla a mi. Duis sapien sem, aliquet nec, commodo eget, consequat quis, neque. Aliquam faucibus, elit ut dictum aliquet, felis nisl adipiscing sapien, sed malesuada diam lacus eget erat.',
  'Cras mollis scelerisque nunc. Nullam arcu. Aliquam consequat. Curabitur augue lorem, dapibus quis, laoreet et, pretium ac, nisi. Aenean magna nisl, mollis quis, molestie eu, feugiat in, orci. In hac habitasse platea dictumst.',
  'Vivamus euismod mauris. In ut quam vitae odio lacinia tincidunt. Praesent ut ligula non mi varius sagittis. Cras sagittis. Phasellus nec dui vitae tortor tincidunt pulvinar. Nam quis nulla. Integer malesuada.',
  'Nam at tortor in tellus interdum sagittis. Aliquam purus turpis, dignissim quis, gravida a, convallis ac, velit. Quisque ullamcorper placerat ipsum. Cras nibh. Morbi vel justo vitae lacus tincidunt ultrices.',
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer nec odio. Praesent libero. Sed cursus ante dapibus diam. Sed nisi. Nulla quis sem at nibh elementum imperdiet. Duis sagittis ipsum.',
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
              <Dialog.Title className="font-display text-[24px] font-extrabold italic uppercase leading-[0.96] text-ink">
                AI Policy
              </Dialog.Title>
              <Dialog.Description className="mt-[7px] font-mono text-[11px] tracking-[0.1em] uppercase text-muted-2">
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
            {LOREM.map((p, i) => (
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
