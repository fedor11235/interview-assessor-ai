import { AppWindow, Check, Monitor, RefreshCw } from 'lucide-react'

interface SourcePickerProps {
  sources: CaptureSourceDescriptor[]
  selectedSourceId?: string
  disabled?: boolean
  loading?: boolean
  error?: string
  onRefresh: () => void
  onSelect: (sourceId: string) => void
}

export function SourcePicker({
  sources,
  selectedSourceId,
  disabled,
  loading,
  error,
  onRefresh,
  onSelect
}: SourcePickerProps) {
  return (
    <section className="panel source-panel" aria-label="Capture source">
      <header className="panel-header">
        <div>
          <p className="eyebrow">Capture source</p>
          <h2>Окно для анализа</h2>
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={onRefresh}
          disabled={disabled || loading}
          aria-label="Refresh capture sources"
        >
          <RefreshCw size={17} aria-hidden="true" />
        </button>
      </header>

      {error ? <p className="source-error">{error}</p> : null}

      <div className="source-list">
        {sources.map((source) => {
          const selected = source.id === selectedSourceId
          const Icon = source.kind === 'screen' ? Monitor : AppWindow

          return (
            <button
              type="button"
              className={selected ? 'source-card selected' : 'source-card'}
              key={source.id}
              onClick={() => onSelect(source.id)}
              disabled={disabled}
            >
              <img src={source.thumbnail} alt="" />
              <span className="source-meta">
                {source.appIcon ? <img src={source.appIcon} alt="" /> : <Icon size={15} aria-hidden="true" />}
                <strong>{source.name}</strong>
                {selected ? <Check size={15} aria-hidden="true" /> : null}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

