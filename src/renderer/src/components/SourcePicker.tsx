import { AppWindow, Check, Monitor, RefreshCw } from 'lucide-react'

interface SourcePickerProps {
  sources: CaptureSourceDescriptor[]
  selectedSourceId?: string
  accessStatus?: ScreenAccessStatus
  disabled?: boolean
  loading?: boolean
  error?: string
  onRefresh: () => void
  onOpenScreenSettings: () => void
  onSelect: (sourceId: string) => void
}

export function SourcePicker({
  sources,
  selectedSourceId,
  accessStatus,
  disabled,
  loading,
  error,
  onRefresh,
  onOpenScreenSettings,
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

      {sources.length > 0 ? (
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
      ) : (
        <div className="source-empty">
          <Monitor size={20} aria-hidden="true" />
          <div>
            <strong>Список окон пока пуст</strong>
            <p>
              Нажми Start, чтобы выбрать окно через системный picker. Если macOS не показывает окна, разреши Screen
              Recording для Electron.
            </p>
            {accessStatus && accessStatus !== 'granted' ? (
              <button type="button" className="secondary-button" onClick={onOpenScreenSettings}>
                Открыть настройки
              </button>
            ) : null}
          </div>
        </div>
      )}
    </section>
  )
}
