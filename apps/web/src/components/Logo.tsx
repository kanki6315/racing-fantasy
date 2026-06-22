/** The ENDURANCE FANTASY wordmark: two skewed bars (red/white) + condensed italic type. */
export function Logo({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-[9px] ${className}`}>
      <div className="flex gap-[3px]">
        <div className="h-[22px] w-[6px] bg-brand [transform:skewX(-14deg)]" />
        <div className="h-[22px] w-[6px] bg-ink [transform:skewX(-14deg)]" />
      </div>
      <div className="font-display text-[21px] font-extrabold italic text-ink">
        ENDURANCE<span className="text-brand">FANTASY</span>
      </div>
    </div>
  )
}
