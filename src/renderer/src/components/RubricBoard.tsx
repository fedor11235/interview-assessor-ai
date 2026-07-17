import { Minus, Plus } from 'lucide-react'
import type { RubricItem } from '../lib/session'

interface RubricBoardProps {
  items: RubricItem[]
  onChange: (id: string, score: number) => void
}

export function RubricBoard({ items, onChange }: RubricBoardProps) {
  return (
    <section className="panel rubric-panel" aria-label="Rubric">
      <header className="panel-header">
        <div>
          <p className="eyebrow">Rubric</p>
          <h2>Оценка</h2>
        </div>
      </header>

      <div className="rubric-list">
        {items.map((item) => (
          <div className="rubric-row" key={item.id}>
            <div>
              <strong>{item.label}</strong>
              <span>
                {item.score}/{item.max}
              </span>
            </div>
            <div className="stepper">
              <button
                type="button"
                aria-label={`Decrease ${item.label}`}
                onClick={() => onChange(item.id, Math.max(0, item.score - 1))}
              >
                <Minus size={16} aria-hidden="true" />
              </button>
              <meter min={0} max={item.max} value={item.score} />
              <button
                type="button"
                aria-label={`Increase ${item.label}`}
                onClick={() => onChange(item.id, Math.min(item.max, item.score + 1))}
              >
                <Plus size={16} aria-hidden="true" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

