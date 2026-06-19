import { useEffect, useState } from 'react'

/** Client-side lock countdown from the round's quali_start (ADR-0002). Server stays authoritative. */
export function useCountdown(target: string | undefined) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  if (!target) return { locked: false, text: '—' }
  const ms = new Date(target).getTime() - now
  if (ms <= 0) return { locked: true, text: 'LOCKED' }

  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return { locked: false, text: d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m ${sec}s` }
}
