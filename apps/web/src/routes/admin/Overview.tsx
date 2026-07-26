import { Link } from 'react-router-dom'
import { useAdmin } from '../../admin/AdminContext'
import { AdminPageHeader } from '../../admin/AdminPageHeader'
import { ChampionshipBand } from '../../admin/ChampionshipBand'
import { ErrorPanel, PRIMARY_ACTION_CLASS } from '../../admin/ui'
import {
  useAdminClasses,
  useCarEntries,
  useAdminSessions,
  useEntryDrivers,
  useScores,
  useScoringRulesets,
  type SessionDto,
  type CarEntryDto,
  type ScoresResponse,
  type RulesetDto,
} from '../../api/adminQueries'
import { usePrices } from '../../api/queries'
import { useCountdown, useNow } from '../../lib/useCountdown'
import { inferPriceMode, pricingProgress } from '../../lib/pricing'

/**
 * The round's setup, as a sequence with one thing to do next.
 *
 * The screen used to be six equal cards, none of them a link, none of them saying which one
 * mattered — an operator read "54 of 55 cars priced", then moved their eyes to the sidebar and
 * clicked the word they had just read. The steps are not equal: exactly one of them is what the
 * operator should do next, and this screen's whole job is to name it. So the first unfinished step
 * is lifted out of the row into a band with the real number, the consequence of leaving it, and the
 * page's one primary action. The rest stay as a divided rail — a glance at progress, and six doors
 * that open.
 */

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso)
    .toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    .toUpperCase()
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

/**
 * `blocked` is not "not started" — it is "started and cannot finish". Scoring a season with no
 * active ruleset does not fail: the engine resolves every rank to 0 points and reports a successful
 * run, so a missing ruleset is invisible everywhere else in the console.
 *
 * `missed` is the state the screen was missing entirely: a setup step still incomplete *after* the
 * lock. It is not work queued up, it is work that didn't happen in time — a round that locked with
 * 22 of 55 cars unpriced denied those players a roster, and no amount of pricing it now changes
 * that. Treating it as a to-do produced a red call-to-action on rounds that finished a fortnight ago.
 */
type StepState = 'done' | 'active' | 'blocked' | 'missed' | 'todo'

type Step = {
  n: number
  label: string
  /** Where this step is done. Two of them are tabs of Catalog, which is why Catalog reads `?tab=`. */
  to: string
  /** The rail's glance figure — tabular, comparable, short enough to survive a 168px cell. */
  tally: string
  /** The same fact as a sentence, for the link's accessible name. */
  detail: string
  /** Hero copy, used only when this step is the one blocking. `alert` is the compressed version
   *  for the one-line strip a blocked step gets when some *earlier* step owns the hero. */
  hero: { headline: string; consequence: string; action: string; actionTo?: string; alert?: string }
  /** Past-tense copy for the same shortfall once the lock has passed and it can no longer be fixed. */
  postMortem?: string
  /** Setup work, i.e. only actionable before the lock. Results and Scoring are the post-race steps. */
  preLock: boolean
  state: StepState
}

/**
 * Marker vocabulary. Brand red is deliberately absent: it belongs to the primary action and to the
 * rail's current-step rule, and nothing else. When `active` was brand red, a round with three
 * genuinely in-progress steps lit three red rings and red stopped meaning "this is the one to do" —
 * which is the entire point of the hero. In-progress is now a neutral step-up from `todo`, and the
 * only thing that says *which* step matters is the one the hero names.
 */
const MARK: Record<StepState, { ring: string; glyph: (n: number) => string }> = {
  done: { ring: 'border-success/50 text-success', glyph: (n) => String(n).padStart(2, '0') },
  active: { ring: 'border-line-3 text-ink-2', glyph: (n) => String(n).padStart(2, '0') },
  blocked: { ring: 'border-warn/60 text-warn', glyph: () => '!' },
  missed: { ring: 'border-danger/60 text-danger', glyph: () => '×' },
  todo: { ring: 'border-line-2 text-muted', glyph: () => '○' },
}

// Three of the six steps have no denominator to be complete against — a round has however many
// classes, cars and sessions the operator gives it. Their accessible name says "set", not "done",
// because the system genuinely cannot know whether 12 of 55 cars is the whole entry list.
const COUNTED_ONLY = new Set([1, 2, 4])

const STATE_WORD: Record<StepState, string> = {
  done: 'done',
  active: 'in progress',
  blocked: 'blocked',
  missed: 'incomplete at lock',
  todo: 'not started',
}

/** Every count below is derived from data on screen. Nothing in this function is a fixed string. */
function buildSteps(input: {
  classCount: number
  carCount: number
  pricing: { mode: 'Car' | 'Driver'; priced: number; total: number; unpricedIds: number[] }
  /** Cars by id, so a small shortfall can be named rather than counted. */
  carsById: Map<number, CarEntryDto>
  sessions: SessionDto[]
  scores: ScoresResponse | undefined
  rulesets: RulesetDto[]
  /** Whether `rulesets` is an answer or a placeholder. An empty list means "none are active";
   *  a failed fetch also arrives as an empty list, and raising a configuration alarm off a network
   *  error is the same class of lie this screen was rebuilt to stop telling. */
  rulesetsKnown: boolean
}): Step[] {
  const { classCount, carCount, pricing, carsById, sessions, scores, rulesets, rulesetsKnown } = input

  // Prices. `total` is the universe this series actually prices — cars, or the round's driver
  // lineup. Counting cars against every priced entity is how "all priced" used to appear over a
  // round whose 17 driver prices were checked against its 17 unpriced cars.
  const noun = pricing.mode === 'Car' ? 'cars' : 'drivers'
  const nounOne = pricing.mode === 'Car' ? 'car' : 'driver'
  const shortOf = pricing.total - pricing.priced
  const priceConsequence = `Players can't build a roster until every ${nounOne} in the round has a price.`

  // Name the shortfall when it is small enough to name. Only car mode: the entry list is already on
  // this screen, whereas driver names would mean fetching every driver in the database to label three
  // of them. Beyond three the list stops being a hint and starts being the board itself.
  const namedShortfall =
    pricing.mode === 'Car' && pricing.unpricedIds.length > 0 && pricing.unpricedIds.length <= 3
      ? pricing.unpricedIds
          .map((id) => carsById.get(id))
          .filter((c): c is CarEntryDto => !!c)
          .map((c) => `#${c.number ?? '—'} ${c.teamName}`)
          .join(', ')
      : ''
  const price: Pick<Step, 'tally' | 'detail' | 'state' | 'hero' | 'postMortem'> =
    pricing.total === 0
      ? {
          tally: 'no entries yet',
          detail: 'nothing to price yet',
          state: 'todo',
          hero: {
            headline: 'There is nothing to price yet.',
            consequence: 'Prices are set against the entry list, so the round needs its entries first.',
            action: 'Import entries',
            actionTo: '/admin/entries',
          },
        }
      : pricing.priced === 0
        ? {
            tally: `0/${pricing.total} ${noun}`,
            detail: `0 of ${pricing.total} ${noun} priced`,
            state: 'todo',
            postMortem: `locked with none of the ${pricing.total} ${noun} priced, so nobody could build a roster.`,
            hero: {
              headline: `None of the ${pricing.total} ${noun} have a price yet.`,
              consequence: priceConsequence,
              action: 'Set prices',
            },
          }
        : pricing.priced < pricing.total
          ? {
              tally: `${pricing.priced}/${pricing.total} ${noun}`,
              detail: `${pricing.priced} of ${pricing.total} ${noun} priced`,
              state: 'active',
              postMortem: `locked with ${shortOf} of ${pricing.total} ${noun} unpriced${namedShortfall ? ` (${namedShortfall})` : ''}, so ${plural(shortOf, 'that one was', 'those were')} unpickable.`,
              hero: {
                headline: namedShortfall
                  ? `${namedShortfall} still ${plural(shortOf, 'needs', 'need')} a price.`
                  : `${shortOf} ${plural(shortOf, nounOne, noun)} still ${plural(shortOf, 'needs', 'need')} a price.`,
                consequence: priceConsequence,
                action: 'Set prices',
              },
            }
          : {
              tally: `${pricing.total}/${pricing.total} ${noun}`,
              detail: `all ${pricing.total} ${noun} priced`,
              state: 'done',
              hero: { headline: '', consequence: '', action: '' },
            }

  // Results. Committing a results import publishes the sessions it touched, so session status is a
  // real ingestion signal rather than the fixed "awaiting ingest" this step used to print.
  const published = sessions.filter((s) => s.status === 'Published').length
  const outstanding = sessions.length - published
  const resultConsequence = 'Scoring reads finishing positions out of imported session results.'
  const results: Pick<Step, 'tally' | 'detail' | 'state' | 'hero' | 'postMortem'> =
    sessions.length === 0
      ? {
          tally: 'no sessions',
          detail: 'no sessions to import',
          state: 'todo',
          hero: {
            headline: 'There are no sessions to import results into.',
            consequence: 'Results attach to a session, so the round needs its qualifying and race sessions first.',
            action: 'Add sessions',
            actionTo: '/admin/catalog?tab=sessions',
          },
        }
      : published === 0
        ? {
            tally: `0/${sessions.length} sessions`,
            detail: `0 of ${sessions.length} sessions imported`,
            state: 'todo',
            hero: {
              headline: `No results imported for ${plural(sessions.length, 'this session', `any of the ${sessions.length} sessions`)}.`,
              consequence: resultConsequence,
              action: 'Import results',
            },
          }
        : published < sessions.length
          ? {
              tally: `${published}/${sessions.length} sessions`,
              detail: `${published} of ${sessions.length} sessions imported`,
              state: 'active',
              hero: {
                headline: `${outstanding} ${plural(outstanding, 'session', 'sessions')} still ${plural(outstanding, 'needs', 'need')} results.`,
                consequence: resultConsequence,
                action: 'Import results',
              },
            }
          : {
              tally: `${sessions.length}/${sessions.length} sessions`,
              detail: `all ${sessions.length} sessions imported`,
              state: 'done',
              hero: { headline: '', consequence: '', action: '' },
            }

  // Scoring. Ruleset coverage is checked first, and only for the sources this round can actually
  // score — a race-only weekend needs no qualifying table and shouldn't be flagged for missing one.
  const activeSources = new Set(rulesets.filter((r) => r.status === 'Active').map((r) => r.source))
  const missing: string[] = []
  if (rulesetsKnown) {
    if (sessions.some((s) => s.type === 'Qualifying') && !activeSources.has('QualifyingPosition')) missing.push('quali')
    if (sessions.some((s) => s.type === 'Race') && !activeSources.has('RacePosition')) missing.push('race')
  }

  const rosters = scores?.registrations ?? []
  const scored = rosters.filter((r) => r.picks.some((p) => p.scores.length > 0)).length
  const scoring: Pick<Step, 'tally' | 'detail' | 'state' | 'hero' | 'postMortem'> = missing.length
    ? {
        tally: 'no ruleset',
        detail: `no active ${missing.join(' + ')} ruleset`,
        state: 'blocked',
        hero: {
          headline: 'Scoring would post zeroes.',
          consequence: `This season has no active ${missing.join(' or ')} ruleset, so every position resolves to 0 points — and the run still reports success.`,
          alert: `no active ${missing.join(' or ')} ruleset for this season, so a run would post zeroes.`,
          action: 'Author a ruleset',
          actionTo: '/admin/rulesets',
        },
      }
    : rosters.length === 0
      ? {
          tally: 'no rosters',
          detail: 'no rosters to score',
          state: 'todo',
          hero: {
            headline: 'Nobody has a roster in this round yet.',
            consequence: 'There is nothing to score until players lock a lineup.',
            action: 'Open scoring',
          },
        }
      : scored === 0
        ? {
            tally: `0/${rosters.length} rosters`,
            detail: `${rosters.length} rosters, not scored`,
            state: 'todo',
            hero: {
              headline: `${rosters.length} ${plural(rosters.length, 'roster is', 'rosters are')} waiting to be scored.`,
              consequence: 'Players see no points for this round until scoring runs.',
              action: 'Run scoring',
            },
          }
        : scored < rosters.length
          ? {
              tally: `${scored}/${rosters.length} rosters`,
              detail: `${scored} of ${rosters.length} rosters scored`,
              state: 'active',
              hero: {
                headline: `${rosters.length - scored} of ${rosters.length} rosters ${plural(rosters.length - scored, 'has', 'have')} no points.`,
                consequence: 'A partial run usually means results landed after scoring — run it again to pick up the rest.',
                action: 'Run scoring',
              },
            }
          : {
              tally: `${rosters.length}/${rosters.length} rosters`,
              detail: `all ${rosters.length} rosters scored`,
              state: 'done',
              hero: { headline: '', consequence: '', action: '' },
            }

  return [
    {
      n: 1,
      label: 'Catalog',
      to: '/admin/catalog?tab=classes',
      tally: classCount ? `${classCount} ${plural(classCount, 'class', 'classes')}` : 'none',
      // No trailing "set" here: the accessible name appends the state word, and this read
      // "Catalog — 4 classes set, set" to a screen reader while looking perfect on screen.
      detail: classCount ? `${classCount} ${plural(classCount, 'class', 'classes')}` : 'no classes yet',
      state: classCount ? 'done' : 'todo',
      preLock: true,
      postMortem: 'locked with no classes set.',
      hero: {
        headline: 'This championship has no classes yet.',
        consequence: 'Entries, prices and scoring all key off class — nothing else in the round can be set up first.',
        action: 'Add classes',
      },
    },
    {
      n: 2,
      label: 'Entries',
      to: '/admin/entries',
      tally: carCount ? `${carCount} cars` : 'none',
      detail: carCount ? `${carCount} cars imported` : 'no entry list yet',
      state: carCount ? 'done' : 'todo',
      preLock: true,
      postMortem: 'locked with no entry list imported, so there was nothing to pick.',
      hero: {
        headline: 'No entry list imported for this round.',
        consequence: "Importing the weekend's entry list creates the cars and driver lineups players pick from.",
        action: 'Import entries',
      },
    },
    { n: 3, label: 'Prices', to: '/admin/prices', preLock: true, ...price },
    {
      n: 4,
      label: 'Sessions',
      to: '/admin/catalog?tab=sessions',
      tally: sessions.length ? `${sessions.length} scheduled` : 'none',
      detail: sessions.length ? `${sessions.length} scheduled` : 'none scheduled',
      state: sessions.length ? 'done' : 'todo',
      preLock: true,
      postMortem: 'locked with no sessions scheduled.',
      hero: {
        headline: 'No sessions scheduled for this round.',
        consequence: 'Qualifying and race sessions have to exist before any result can be imported against them.',
        action: 'Add sessions',
      },
    },
    { n: 5, label: 'Results', to: '/admin/results', preLock: false, ...results },
    { n: 6, label: 'Scoring', to: '/admin/scoring', preLock: false, ...scoring },
  ]
}

// ---------------------------------------------------------------- the rail

/**
 * The sequence, as a divided strip rather than six free-floating cards. A timing screen is a row of
 * divided cells, not a wizard's stepper, and the divided form also says "these are ordered" where
 * six equal cards said "these are a menu". Hairlines come from a 1px grid gap over a `line`-coloured
 * panel, so they stay correct at every wrap without any cell knowing its own position.
 */
function StepRail({ steps, currentN }: { steps: Step[]; currentN: number | null }) {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[6px] border border-line bg-line sm:grid-cols-3 lg:grid-cols-6">
      {steps.map((s) => {
        const mark = MARK[s.state]
        const isCurrent = s.n === currentN
        return (
          <Link
            key={s.n}
            to={s.to}
            aria-current={isCurrent ? 'step' : undefined}
            // The label *is* the destination here — "Prices" is the name of the screen it opens —
            // but the state and count only exist visually, so the accessible name carries them.
            aria-label={`${s.label} — ${s.detail}, ${
              s.state === 'done' && COUNTED_ONLY.has(s.n) ? 'set' : STATE_WORD[s.state]
            }`}
            // The current cell takes the nav's active-link language — surface-2 fill, ink label, and
            // a 2px brand underline drawn as an *inset* shadow so it gains an edge without shifting a
            // pixel. The fill alone measured 1.05:1 against its neighbours and was invisible in
            // practice; the rule is what actually ties this cell to the band above it.
            className={`group flex flex-col gap-[6px] px-4 py-3 transition-colors ${
              isCurrent
                ? 'bg-surface-2 shadow-[inset_0_-2px_0_0_var(--color-brand)]'
                : 'bg-surface hover:bg-surface-2'
            }`}
          >
            <div className="flex items-center gap-[10px]">
              <span
                className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border font-mono text-[10px] ${mark.ring}`}
                aria-hidden="true"
              >
                {mark.glyph(s.n)}
              </span>
              <span
                className={`truncate font-display text-[13px] font-semibold uppercase tracking-[0.03em] transition-colors ${
                  isCurrent ? 'text-ink' : 'text-ink-2 group-hover:text-ink'
                }`}
              >
                {s.label}
              </span>
            </div>
            <span className="truncate font-mono text-[10px] tracking-[0.04em] text-muted">{s.tally}</span>
          </Link>
        )
      })}
    </div>
  )
}

/** Mirrors a rail cell's exact structure so the resolved rail lands at the height it replaces. */
function RailSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[6px] border border-line bg-line sm:grid-cols-3 lg:grid-cols-6">
      {[1, 2, 3, 4, 5, 6].map((n) => (
        <div key={n} className="flex flex-col gap-[6px] bg-surface px-4 py-3" aria-hidden="true">
          <div className="flex items-center gap-[10px]">
            <span className="h-[22px] w-[22px] shrink-0 rounded-full border border-line-2" />
            <span className="font-display text-[13px] font-semibold uppercase tracking-[0.03em]">
              <span className="inline-block h-[0.7em] w-16 rounded-[2px] bg-line-2 align-middle" />
              {'​'}
            </span>
          </div>
          <span className="font-mono text-[10px] tracking-[0.04em]">
            <span className="inline-block h-[0.7em] w-20 rounded-[2px] bg-line align-middle" />
            {'​'}
          </span>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------- the hero

/**
 * The one thing to do next. Deliberately a sentence with a number inside it rather than a big
 * figure with a caption under it: the operator needs to know what is wrong and what it costs, and
 * "1" on its own answers neither.
 */
function NextUp({ step }: { step: Step }) {
  const tone =
    step.state === 'blocked'
      ? { shell: 'border-warn/35 bg-warn/[0.07]', chip: 'text-warn' }
      : { shell: 'border-line-2 bg-surface', chip: 'text-brand-3' }

  return (
    <section
      aria-labelledby="next-up-heading"
      className={`settle-in flex flex-col gap-4 rounded-[6px] border px-5 py-[18px] md:flex-row md:items-center md:justify-between md:gap-8 ${tone.shell}`}
    >
      <div className="min-w-0">
        <p className={`font-mono text-[10px] tracking-[0.14em] uppercase ${tone.chip}`}>
          Next up · {step.label}
        </p>
        <h2
          id="next-up-heading"
          className="mt-[6px] font-display text-[22px] font-bold uppercase leading-[1.05] tracking-[0.01em] text-ink"
          style={{ textWrap: 'balance' }}
        >
          {step.hero.headline}
        </h2>
        <p className="mt-[6px] max-w-[68ch] font-sans text-[13px] leading-[1.5] text-ink-2" style={{ textWrap: 'pretty' }}>
          {step.hero.consequence}
        </p>
      </div>
      <Link to={step.hero.actionTo ?? step.to} className={`${PRIMARY_ACTION_CLASS} shrink-0 self-start md:self-auto`}>
        {step.hero.action}
        <span aria-hidden="true">→</span>
      </Link>
    </section>
  )
}

/** Everything is done. A confirmation, not an empty slot — and pointedly not a red band. */
function RoundReady({
  roundSequence,
  locked,
  shortfall,
}: {
  roundSequence: number
  locked: boolean
  /** True when the round finished but some setup step never completed before the lock. */
  shortfall: boolean
}) {
  return (
    <section
      aria-labelledby="next-up-heading"
      className="settle-in flex flex-col gap-4 rounded-[6px] border border-success/30 bg-success/[0.05] px-5 py-[18px] md:flex-row md:items-center md:justify-between md:gap-8"
    >
      <div className="min-w-0">
        <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-success">
          {shortfall ? 'Nothing left to do' : 'Nothing outstanding'}
        </p>
        <h2
          id="next-up-heading"
          className="mt-[6px] font-display text-[22px] font-bold uppercase leading-[1.05] tracking-[0.01em] text-ink"
        >
          {/* "Fully set up" would be a lie over a round that locked with cars unpriced, so the
              headline states what is actually true — the work is finished — and the strip above
              carries what went wrong. */}
          Round {String(roundSequence).padStart(2, '0')} is {shortfall ? 'closed out.' : 'fully set up.'}
        </h2>
        <p className="mt-[6px] max-w-[68ch] font-sans text-[13px] leading-[1.5] text-ink-2">
          {shortfall
            ? 'Results are in and every roster is scored. Nothing here can still be fixed — see the note above for what this round shipped without.'
            : locked
              ? 'Results are in and every roster is scored. Switch rounds in the topbar to set up the next one.'
              : 'Every step is complete ahead of the lock. Switch rounds in the topbar to set up the next one.'}
        </p>
      </div>
      <Link
        to="/admin/scoring"
        className="inline-flex h-9 shrink-0 items-center gap-2 self-start rounded-[4px] border border-line-2 px-4 font-display text-[12px] font-semibold uppercase tracking-[0.05em] text-ink-2 transition-colors hover:border-line-3 hover:text-ink md:self-auto"
      >
        Review scoring
        <span aria-hidden="true">→</span>
      </Link>
    </section>
  )
}

/**
 * What the round shipped without. Reports, it does not instruct: there is no action, because the
 * deadline is the whole point — pricing a car now cannot un-deny the roster nobody could build.
 * Stated in the past tense for the same reason, which is precisely what the old screen got wrong
 * when it put "Players can't build a roster" over a round that finished a fortnight ago.
 */
function ShippedWithout({ steps }: { steps: Step[] }) {
  return (
    <div
      role="status"
      className="settle-in rounded-[6px] border border-danger/35 bg-danger/[0.06] px-5 py-[14px]"
    >
      <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-danger">Locked incomplete</p>
      <ul className="mt-[6px] space-y-[3px]">
        {steps.map((s) => (
          <li key={s.n} className="max-w-[68ch] font-sans text-[13px] leading-[1.5] text-ink-2">
            <span className="font-semibold text-ink">{s.label}</span> — {s.postMortem ?? s.detail}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Mirrors the hero's box so the swap from skeleton to content doesn't move the rail. */
function NextUpSkeleton() {
  return (
    <div className="rounded-[6px] border border-line-2 bg-surface px-5 py-[18px]" aria-hidden="true">
      <p className="font-mono text-[10px] tracking-[0.14em] uppercase">
        <span className="inline-block h-[0.7em] w-40 rounded-[2px] bg-line-2 align-middle" />
        {'​'}
      </p>
      <p className="mt-[6px] font-display text-[22px] font-bold leading-[1.05]">
        <span className="inline-block h-[0.6em] w-[min(420px,70%)] rounded-[2px] bg-line-2 align-middle" />
        {'​'}
      </p>
      <p className="mt-[6px] font-sans text-[13px] leading-[1.5]">
        <span className="inline-block h-[0.7em] w-[min(560px,90%)] rounded-[2px] bg-line align-middle" />
        {'​'}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------- lock

/**
 * The lock's prominence follows the deadline instead of outranking everything forever. Inside the
 * final day it is the live state and earns a band; before that, and once it is history, it is a fact
 * about the round and rides in the header. A permanent red band about an expired deadline is not
 * "calm under stakes", it is a thing the operator learns to look past — taking the page's real
 * headline down with it.
 */
const LOCK_BAND_WINDOW_MS = 24 * 60 * 60 * 1000

/**
 * Deliberately the *date* and not the countdown: the topbar already runs a live countdown on every
 * admin screen, so repeating the same figure 60px below it would trade one duplicated element for
 * another. This carries the one thing the topbar has no room for — when, absolutely — and lets the
 * ticking number stay in the one place that shows it everywhere.
 */
function LockPill({ qualiStart }: { qualiStart: string }) {
  return (
    <div className="text-right">
      {/* Labelled by the *moment*, not the state. The topbar already prints the lock's state a few
          pixels above; when this said "Locked" too, the word appeared twice in one glance and the
          page still hadn't told the operator when. Now the bar owns the state, this owns the time. */}
      <div className="font-mono text-[9px] tracking-[0.12em] uppercase text-muted">Quali start</div>
      <div className="mt-[2px] font-mono text-[11px] tracking-[0.04em] text-ink-2">{fmtDate(qualiStart)}</div>
    </div>
  )
}

/**
 * The band only appears inside the final day, which is exactly when the deadline and the round's
 * readiness stop being separate facts. It used to announce the lock and say nothing about the
 * pipeline, so "locks in two hours" and "22 cars still have no price" sat on the same screen
 * without either one mentioning the other — the operator had to join them. `outstanding` is the
 * pre-lock work that won't survive the deadline, and naming it here is the whole point of a band
 * that only shows up when there is no time left.
 */
function LockBand({
  qualiStart,
  text,
  outstanding,
}: {
  qualiStart: string
  text: string
  outstanding: Step[]
}) {
  return (
    <div
      className="flex items-center justify-between gap-4 rounded-[6px] border border-brand/30 bg-brand/[0.06] px-5 py-4"
      role="status"
    >
      <div className="flex min-w-0 items-center gap-3">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0">
          <rect x="5" y="11" width="14" height="9" rx="2" stroke="#ffc23d" strokeWidth="2" />
          <path d="M8 11V8a4 4 0 018 0v3" stroke="#ffc23d" strokeWidth="2" />
        </svg>
        <div className="min-w-0">
          <div className="font-display text-[14px] font-semibold uppercase tracking-[0.04em] text-ink">
            Player lock today · qualifying start
          </div>
          <div className="max-w-[68ch] font-mono text-[11px] tracking-[0.04em] text-muted">
            {fmtDate(qualiStart)} ·{' '}
            {outstanding.length > 0
              ? `still unfinished: ${outstanding.map((s) => `${s.label.toLowerCase()} (${s.detail})`).join(', ')}`
              : 'lineups lock for all players when qualifying begins'}
          </div>
        </div>
      </div>
      <div className="shrink-0 font-mono text-[15px] font-medium text-warn">{text} remaining</div>
    </div>
  )
}

// ---------------------------------------------------------------- page

export function AdminOverview() {
  const { championshipId, seasonId, round, isResolving, contextError, retryContext } = useAdmin()

  const classQ = useAdminClasses(championshipId)
  const carQ = useCarEntries(seasonId)
  const sessionQ = useAdminSessions(round?.id)
  const priceQ = usePrices(round?.id ?? 0)
  const scoreQ = useScores(round?.id ?? 0)
  const rulesetQ = useScoringRulesets(seasonId)
  // Only a driver-priced series needs the (unfiltered, potentially large) lineup list. The mode is
  // read from the round's own prices, so this stays idle until they arrive — and stays idle for
  // good on a team-priced series.
  const priceMode = inferPriceMode(priceQ.data ?? [])
  const lineupQ = useEntryDrivers(undefined, { enabled: priceMode === 'Driver' })

  const lock = useCountdown(round?.qualiStart)
  // `now` as state, not `Date.now()` in the render body — the band has to promote itself when the
  // deadline crosses into the final day, and a value read during render can neither be depended on
  // nor update when the moment it describes passes (see lib/useCountdown).
  const now = useNow(1000)
  const lockImminent =
    !!round && !lock.locked && new Date(round.qualiStart).getTime() - now <= LOCK_BAND_WINDOW_MS

  const queries = [
    { name: 'classes', q: classQ },
    { name: 'entries', q: carQ },
    { name: 'sessions', q: sessionQ },
    { name: 'prices', q: priceQ },
    { name: 'scores', q: scoreQ },
    { name: 'rulesets', q: rulesetQ },
    { name: 'lineups', q: lineupQ },
  ]
  const failed = queries.filter((x) => x.q.isError)
  // Keyed off `isFetching`, not `isPending`: a disabled query is pending forever, so the
  // team-priced case (lineups never enabled) would otherwise show a skeleton that never resolves.
  const loading = queries.some((x) => x.q.isFetching && x.q.data === undefined)

  const built = buildSteps({
    classCount: classQ.data?.length ?? 0,
    carCount: carQ.data?.length ?? 0,
    pricing: pricingProgress(carQ.data ?? [], lineupQ.data ?? [], priceQ.data ?? [], round?.id),
    carsById: new Map((carQ.data ?? []).map((c) => [c.id, c])),
    sessions: sessionQ.data ?? [],
    scores: scoreQ.data,
    rulesets: rulesetQ.data ?? [],
    rulesetsKnown: rulesetQ.isSuccess,
  })

  // The lock is what makes a step actionable or historical, so it is applied before anything reads
  // the states. Past the deadline a setup step that never finished is not queued work — it is what
  // this round shipped without, and offering to "fix" it is the false urgency that replaced the
  // false state this screen used to print.
  const steps = lock.locked
    ? built.map((s) => (s.preLock && s.state !== 'done' ? { ...s, state: 'missed' as const } : s))
    : built

  // The blocker is the first step that is still both unfinished and doable — sequence order,
  // because that is the order the work actually has to happen in.
  const nextUp = steps.find((s) => s.state !== 'done' && s.state !== 'missed') ?? null
  const missedSteps = steps.filter((s) => s.state === 'missed')
  // A blocked step that *isn't* the hero still has to be heard: a missing ruleset is a configuration
  // fault, not a queue position, and the operator wants to know about it while they're still
  // importing entries rather than after the scoring run silently posts zeroes.
  const blockedElsewhere = steps.find((s) => s.state === 'blocked' && s.n !== nextUp?.n) ?? null

  return (
    <>
      <AdminPageHeader
        title="Round Overview"
        subtitle={
          round
            ? // Name the round *and* the circuit. The topbar selector shows `name` and this line used
              // to show `circuit`, so the same round went by two names 100px apart.
              `RD ${String(round.sequence).padStart(2, '0')} · ${round.name}${round.circuit ? ` · ${round.circuit}` : ''}`
            : contextError
              ? 'The round list failed to load.'
              : isResolving
                ? 'Loading rounds…'
                : 'Select a round from the topbar to begin.'
        }
        actions={
          round && !lockImminent ? <LockPill qualiStart={round.qualiStart} /> : undefined
        }
      />

      {contextError ? (
        <ErrorPanel message="Couldn't load the championship, season, or round list." onRetry={retryContext} />
      ) : isResolving ? (
        <div className="grid gap-4">
          <NextUpSkeleton />
          <RailSkeleton />
        </div>
      ) : !round ? (
        <div className="rounded-[6px] border border-dashed border-line-2 bg-surface/40 px-6 py-10 text-center font-mono text-[11px] tracking-[0.08em] uppercase text-muted">
          No round selected — pick one from the topbar
        </div>
      ) : (
        <div className="grid gap-4">
          <ChampionshipBand />

          {lockImminent && (
            <LockBand
              qualiStart={round.qualiStart}
              text={lock.text}
              outstanding={steps.filter((s) => s.preLock && s.state !== 'done')}
            />
          )}

          {failed.length > 0 && (
            <ErrorPanel
              message={`Couldn't load ${failed.map((f) => f.name).join(', ')}. The steps below are incomplete, not empty.`}
              onRetry={() => failed.forEach((f) => void f.q.refetch())}
            />
          )}

          {loading ? (
            <>
              <NextUpSkeleton />
              <RailSkeleton />
            </>
          ) : (
            <>
              {missedSteps.length > 0 && <ShippedWithout steps={missedSteps} />}

              {nextUp ? (
                <NextUp step={nextUp} />
              ) : (
                <RoundReady
                  roundSequence={round.sequence}
                  locked={lock.locked}
                  shortfall={missedSteps.length > 0}
                />
              )}

              {blockedElsewhere && (
                <Link
                  to={blockedElsewhere.hero.actionTo ?? blockedElsewhere.to}
                  className="group flex items-center justify-between gap-4 rounded-[5px] border border-warn/35 bg-warn/[0.07] px-4 py-[10px] transition-colors hover:bg-warn/[0.12]"
                >
                  <span className="min-w-0 font-sans text-[13px] text-ink-2">
                    <span className="font-semibold text-warn">{blockedElsewhere.label} is blocked</span>
                    {' — '}
                    {blockedElsewhere.hero.alert ?? blockedElsewhere.hero.consequence}
                  </span>
                  <span className="shrink-0 font-mono text-[10px] tracking-[0.1em] uppercase text-muted transition-colors group-hover:text-ink-2">
                    {blockedElsewhere.hero.action} →
                  </span>
                </Link>
              )}

              <section aria-labelledby="pipeline-heading" className="settle-in">
                <h2
                  id="pipeline-heading"
                  className="mb-[10px] font-mono text-[10px] tracking-[0.14em] uppercase text-muted"
                >
                  Round setup pipeline
                </h2>
                <StepRail steps={steps} currentN={nextUp?.n ?? null} />
              </section>
            </>
          )}
        </div>
      )}
    </>
  )
}
