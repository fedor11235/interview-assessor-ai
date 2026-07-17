import { AudioLines, MonitorUp, PanelTopOpen, Square, WandSparkles } from 'lucide-react'
import type { CaptureState, InterviewMode } from '../lib/session'
import { modeLabels } from '../lib/session'

interface TopBarProps {
  mode: InterviewMode
  capture: CaptureState
  consentAccepted: boolean
  onModeChange: (mode: InterviewMode) => void
  onStart: () => void
  onStop: () => void
  onOpenOverlay: () => void
}

export function TopBar({
  mode,
  capture,
  consentAccepted,
  onModeChange,
  onStart,
  onStop,
  onOpenOverlay
}: TopBarProps) {
  const disabled = !consentAccepted

  return (
    <header className="topbar">
      <div className="brand-lockup">
        <div className="mark">IA</div>
        <div>
          <p>Interview Assessor AI</p>
          <span>Desktop console</span>
        </div>
      </div>

      <nav className="segmented" aria-label="Interview mode">
        {(['oral', 'screen-text', 'coding'] as InterviewMode[]).map((item) => (
          <button
            type="button"
            className={item === mode ? 'active' : ''}
            key={item}
            onClick={() => onModeChange(item)}
          >
            {modeLabels[item]}
          </button>
        ))}
      </nav>

      <div className="status-strip">
        <span className={capture.microphone ? 'status active' : 'status'}>
          <AudioLines size={15} aria-hidden="true" /> Mic
        </span>
        <span className={capture.screen ? 'status active' : 'status'}>
          <MonitorUp size={15} aria-hidden="true" /> Screen
        </span>
        <span className={capture.running ? 'status active' : 'status'}>
          <WandSparkles size={15} aria-hidden="true" /> AI
        </span>
      </div>

      <div className="actions">
        <button type="button" className="icon-button" onClick={onOpenOverlay} aria-label="Open overlay">
          <PanelTopOpen size={18} aria-hidden="true" />
        </button>
        {capture.running ? (
          <button type="button" className="danger-button" onClick={onStop}>
            <Square size={16} aria-hidden="true" />
            Stop
          </button>
        ) : (
          <button type="button" className="primary-button" disabled={disabled} onClick={onStart}>
            <WandSparkles size={16} aria-hidden="true" />
            Start
          </button>
        )}
      </div>
    </header>
  )
}

