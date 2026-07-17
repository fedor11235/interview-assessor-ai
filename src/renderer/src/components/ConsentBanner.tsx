import { ShieldCheck } from 'lucide-react'

interface ConsentBannerProps {
  accepted: boolean
  onChange: (accepted: boolean) => void
}

export function ConsentBanner({ accepted, onChange }: ConsentBannerProps) {
  return (
    <section className="consent-band" aria-label="Consent">
      <div className="consent-copy">
        <ShieldCheck size={20} aria-hidden="true" />
        <div>
          <strong>Consent-first режим</strong>
          <span>Запись и анализ запускаются только после явного согласия участников.</span>
        </div>
      </div>
      <label className="toggle">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span>Согласие получено</span>
      </label>
    </section>
  )
}

