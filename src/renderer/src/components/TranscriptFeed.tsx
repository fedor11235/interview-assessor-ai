import { Monitor, Mic, PencilLine } from 'lucide-react'
import type { SignalSource, TranscriptItem } from '../lib/session'

interface TranscriptFeedProps {
  items: TranscriptItem[]
}

const sourceIcons: Record<SignalSource, typeof Mic> = {
  microphone: Mic,
  screen: Monitor,
  manual: PencilLine
}

export function TranscriptFeed({ items }: TranscriptFeedProps) {
  return (
    <section className="panel transcript-panel" aria-label="Transcript">
      <header className="panel-header">
        <div>
          <p className="eyebrow">Signal</p>
          <h2>Live поток</h2>
        </div>
      </header>

      <div className="feed">
        {items.map((item) => {
          const Icon = sourceIcons[item.source]
          return (
            <article className="feed-item" key={item.id}>
              <div className="feed-meta">
                <Icon size={16} aria-hidden="true" />
                <span>{item.time}</span>
                <span>{Math.round(item.confidence * 100)}%</span>
              </div>
              <p>{item.text}</p>
            </article>
          )
        })}
      </div>
    </section>
  )
}

