/** Placeholder for sections built in later phases (Standings/Stats/Calendar). */
export function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-32 text-center">
      <div className="font-display text-[28px] font-extrabold italic uppercase text-ink">{title}</div>
      <div className="font-mono text-[12px] tracking-[0.12em] uppercase text-muted-2">Coming in a later phase</div>
    </div>
  )
}
