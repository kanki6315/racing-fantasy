/** The ENDURANCE FANTASY wordmark: condensed upright type (IMSA-likeness removed for now). */
export function Logo({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center ${className}`}>
      <div className="font-display text-[21px] font-extrabold tracking-tight text-ink">
        ENDURANCE<span className="text-brand">FANTASY</span>
      </div>
    </div>
  )
}
