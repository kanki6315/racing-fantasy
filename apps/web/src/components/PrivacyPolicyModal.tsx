import * as Dialog from '@radix-ui/react-dialog'

const CONTACT_EMAIL = 'fantasy@arjunakankipati.com'

type Block =
  | { type: 'p'; text: string }
  | { type: 'ul'; items: string[] }

type Section = { heading: string; blocks: Block[] }

const SECTIONS: Section[] = [
  {
    heading: 'Who we are',
    blocks: [
      {
        type: 'p',
        text: 'Endurance Fantasy is a free, community-run fantasy game by Arjuna Kankipati. This policy explains what personal data we collect when you use the app, why we collect it, and the choices you have. We are the data controller for the information described here. It is not affiliated with or endorsed by IMSA or any other racing series.',
      },
      {
        type: 'p',
        text: `If you have any questions about this policy or your data, contact us at ${CONTACT_EMAIL}.`,
      },
    ],
  },
  {
    heading: 'Data we collect',
    blocks: [
      {
        type: 'p',
        text: 'We deliberately keep the amount of personal data we hold small. When you sign in with Google and play, we collect:',
      },
      {
        type: 'ul',
        items: [
          'Account identity from Google — a stable Google account identifier (your "sub"), your name, and your email address. We request only the openid, email, and profile scopes. We do not receive or store your Google password, and we do not keep any Google access or refresh tokens.',
          'A session cookie — a single first-party cookie (endurance.session) set after you sign in, used only to keep you logged in.',
        ],
      },
      {
        type: 'p',
        text: 'When you participate in fantasy game play, we collect:',
      },
      {
        type: 'ul',
        items: [
          'Your fantasy team name — a name you choose yourself when you register for a championship season. This is the only identifier shown publicly.',
          'Your gameplay data — your registrations, round-by-round roster picks and bonus selections, scores, standings, and any fantasy leagues you create or join.',
        ],
      },
      {
        type: 'p',
        text: 'We do not collect passwords, payment information, or location data, and we do not use third-party advertising or analytics trackers.',
      },
    ],
  },
  {
    heading: 'How we use your data',
    blocks: [
      {
        type: 'ul',
        items: [
          'To create and operate your account and let you sign in.',
          'To run the game — record your picks, calculate scores, and produce season and league standings.',
          'To send you essential, transactional messages about the game, such as reminders that picks are open or about to lock. We do not send marketing email without your opt-in consent. You can opt-out of transactional emails.',
          'To keep the service secure and prevent abuse.',
        ],
      },
      {
        type: 'p',
        text: 'Our legal basis for processing this data is performance of our agreement with you to provide the game and your account. The session cookie is strictly necessary to provide a service you actively requested by signing in, so it does not require a consent banner.',
      },
    ],
  },
  {
    heading: 'Who can see your information',
    blocks: [
      {
        type: 'ul',
        items: [
          'Your team name is shown on public leaderboards and in any league you join. Public standings are pseudonymous — they show your team name, never your real name or email.',
          'Your real name is shown only to fellow members of a private league you belong to, alongside your team name. It is never shown on public or global standings.',
          'Your email address is never shown or shared with other users — only to you.',
        ],
      },
    ],
  },
  {
    heading: 'Sharing and third parties',
    blocks: [
      {
        type: 'p',
        text: 'We do not sell your personal data or share it for advertising. We rely on a small number of service providers to run the app:',
      },
      {
        type: 'ul',
        items: [
          'Google, as the sign-in provider, authenticates you and supplies the account identity described above. Your use of Google sign-in is also governed by Google’s own privacy policy.',
          'Our hosting providers store and serve the application and database. They process data on our behalf to operate the service.',
        ],
      },
      {
        type: 'p',
        text: 'We may disclose information if required by law, or to protect the rights, safety, and security of our users and the service.',
      },
    ],
  },
  {
    heading: 'Data retention',
    blocks: [
      {
        type: 'p',
        text: 'We keep your account and gameplay data for as long as your account is active. If you ask us to delete your account, we remove your personal data as described below. Routine backups are retained on their normal cycle and then expire.',
      },
    ],
  },
  {
    heading: 'Your rights',
    blocks: [
      {
        type: 'p',
        text: 'Depending on where you live, you may have rights to access, correct, export, or delete your personal data, and to object to or restrict certain processing. You can exercise these rights at any time:',
      },
      {
        type: 'ul',
        items: [
          'Access and portability — we can provide a copy of the account and gameplay data we hold about you.',
          'Erasure — when you delete your account, we delete your account identity, name, and email, and we sever the link between you and your past gameplay. To preserve the integrity of historical standings, your past game records are kept in anonymized form, and your team name is replaced with a neutral label (for example, "Retired Team #1742"). Once anonymized, these records can no longer be linked back to you.',
        ],
      },
      {
        type: 'p',
        text: `To make a request, or if you have a concern, email us at ${CONTACT_EMAIL}. You also have the right to lodge a complaint with your local data protection authority.`,
      },
    ],
  },
  {
    heading: 'California residents — sale and sharing',
    blocks: [
      {
        type: 'p',
        text: 'We do not sell your personal information, and we do not share it for cross-context behavioral advertising, as those terms are defined under the California Consumer Privacy Act (CCPA/CPRA). Because we do not sell or share your information, no opt-out is required.',
      },
      {
        type: 'p',
        text: 'California residents also have the right to know, access, correct, and delete the personal information we hold, and the right not to be discriminated against for exercising these rights. You can exercise them as described in "Your rights" above.',
      },
    ],
  },
  {
    heading: 'Cookies',
    blocks: [
      {
        type: 'p',
        text: 'We use a single first-party cookie, endurance.session, solely to keep you signed in. It is set only after you actively sign in, contains no tracking or advertising data, and is strictly necessary to operate the service. We do not use analytics or advertising cookies.',
      },
    ],
  },
  {
    heading: 'Children',
    blocks: [
      {
        type: 'p',
        text: 'The game is not directed to children, and we do not knowingly collect personal data from children under the age of digital consent in their jurisdiction. If you believe a child has provided us with personal data, please contact us and we will delete it.',
      },
    ],
  },
  {
    heading: 'Changes to this policy',
    blocks: [
      {
        type: 'p',
        text: 'We may update this policy from time to time. When we make material changes, we will update the "last updated" date above and, where appropriate, notify you in the app. A change log will be made available.',
      },
    ],
  },
]

/** Footer "Privacy Policy" link rendered as a dismissible modal with a scrollable body. */
export function PrivacyPolicyModal({ triggerClassName }: { triggerClassName?: string }) {
  return (
    <Dialog.Root>
      <Dialog.Trigger className={triggerClassName}>Privacy Policy</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[rgba(4,5,6,0.78)] backdrop-blur-[3px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[80vh] w-[560px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[6px] border border-line-2 bg-surface-3 shadow-[0_30px_80px_rgba(0,0,0,0.6)] focus:outline-none">
          <div className="h-1 flex-none bg-gradient-to-r from-brand to-brand-3" />
          <div className="flex flex-none items-start justify-between border-b border-line px-7 pb-[18px] pt-[22px]">
            <div>
              <Dialog.Title className="font-display text-[24px] font-extrabold italic uppercase leading-[0.96] text-ink">
                Privacy Policy
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

          <div className="flex flex-col gap-6 overflow-y-auto px-7 py-[22px]">
            {SECTIONS.map((section) => (
              <section key={section.heading} className="flex flex-col gap-2.5">
                <h3 className="font-display text-[13px] font-bold uppercase tracking-[0.08em] text-ink">
                  {section.heading}
                </h3>
                {section.blocks.map((block, i) =>
                  block.type === 'p' ? (
                    <p key={i} className="font-sans text-[13px] leading-[1.7] text-muted">
                      {block.text}
                    </p>
                  ) : (
                    <ul key={i} className="flex flex-col gap-2 pl-1">
                      {block.items.map((item, j) => (
                        <li key={j} className="flex gap-2.5 font-sans text-[13px] leading-[1.7] text-muted">
                          <span aria-hidden="true" className="mt-[10px] h-[3px] w-[3px] flex-none rounded-full bg-brand" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  ),
                )}
              </section>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
