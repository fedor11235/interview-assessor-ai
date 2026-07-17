import {
  AudioLines,
  Cloud,
  Headphones,
  MonitorUp,
  PanelTopOpen,
  PanelsTopLeft,
  Square,
  WandSparkles
} from 'lucide-react'
import appIcon from '../../../../assets/app-icon.svg'
import type { AssistantApiState } from '../lib/assistantApi'
import type { CaptureState, InterviewMode, OutputMode } from '../lib/session'
import { modeLabels } from '../lib/session'

interface TopBarProps {
  mode: InterviewMode
  outputMode: OutputMode
  capture: CaptureState
  apiState: AssistantApiState
  consentAccepted: boolean
  onModeChange: (mode: InterviewMode) => void
  onOutputModeChange: (mode: OutputMode) => void
  onStart: () => void
  onStop: () => void
  onOpenOverlay: () => void
}

export function TopBar({
  mode,
  outputMode,
  capture,
  apiState,
  consentAccepted,
  onModeChange,
  onOutputModeChange,
  onStart,
  onStop,
  onOpenOverlay
}: TopBarProps) {
  const disabled = !consentAccepted

  return (
    <header className="topbar">
      <div className="brand-lockup">
        <div className="mark" aria-hidden="true">
          <img src={appIcon} alt="" />
        </div>
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

      <div className="output-switch" aria-label="Answer output mode">
        <button
          type="button"
          className={outputMode === 'overlay' ? 'active' : ''}
          onClick={() => onOutputModeChange('overlay')}
          aria-label="Показывать ответы оверлеем"
          title="Оверлей"
        >
          <PanelTopOpen size={17} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={outputMode === 'audio' ? 'active' : ''}
          onClick={() => onOutputModeChange('audio')}
          aria-label="Озвучивать ответы"
          title="Звук"
        >
          <Headphones size={17} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={outputMode === 'both' ? 'active' : ''}
          onClick={() => onOutputModeChange('both')}
          aria-label="Показывать и озвучивать ответы"
          title="Оверлей и звук"
        >
          <PanelsTopLeft size={17} aria-hidden="true" />
        </button>
      </div>

      <div className="status-strip">
        <span className={capture.microphone ? 'status active' : 'status'}>
          <AudioLines size={15} aria-hidden="true" /> Mic
        </span>
        <span className={capture.screen ? 'status active' : 'status'}>
          <MonitorUp size={15} aria-hidden="true" /> Screen
        </span>
        <span
          className={
            apiState.status === 'online' || apiState.status === 'thinking'
              ? 'status active'
              : apiState.status === 'offline'
                ? 'status warning'
                : 'status'
          }
          title={apiState.message}
        >
          <Cloud size={15} aria-hidden="true" /> {apiLabel(apiState.status)}
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

function apiLabel(status: AssistantApiState['status']): string {
  if (status === 'thinking') {
    return 'API...'
  }

  if (status === 'online') {
    return 'API'
  }

  if (status === 'offline') {
    return 'Fallback'
  }

  return 'API'
}
