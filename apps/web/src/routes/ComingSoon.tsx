/** Placeholder for sections built in later phases (Standings/Stats/Calendar). */
export function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-24 text-center sm:py-32">
      <div className="font-display text-[24px] font-extrabold italic uppercase text-ink sm:text-[28px]">{title}</div>
      <div className="font-mono text-[12px] tracking-[0.12em] uppercase text-muted-2">Coming in a later phase</div>
    </div>
  )
}
