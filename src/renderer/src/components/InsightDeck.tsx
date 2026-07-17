import { AlertTriangle, ClipboardCheck, MessageSquareText, Sparkles } from 'lucide-react'
import type { InsightCard } from '../lib/session'

interface InsightDeckProps {
  insights: InsightCard[]
}

const icons = {
  'follow-up': MessageSquareText,
  rubric: ClipboardCheck,
  risk: AlertTriangle,
  summary: Sparkles
}

export function InsightDeck({ insights }: InsightDeckProps) {
  return (
    <section className="panel insight-panel" aria-label="AI guidance">
      <header className="panel-header">
        <div>
          <p className="eyebrow">AI guidance</p>
          <h2>Карточки интервьюера</h2>
        </div>
        <span className="pill">live</span>
      </header>

      <div className="insight-list">
        {insights.slice(0, 5).map((insight) => {
          const Icon = icons[insight.kind]
          return (
            <article className={`insight insight-${insight.kind}`} key={insight.id}>
              <div className="insight-icon">
                <Icon size={18} aria-hidden="true" />
              </div>
              <div>
                <div className="insight-title-row">
                  <h3>{insight.title}</h3>
                  <span>{Math.round(insight.confidence * 100)}%</span>
                </div>
                <p>{insight.body}</p>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

