import { useEffect, useMemo, useRef, useState } from 'react'
import { Copy, Download, FileText, LockKeyhole, Move, SendHorizontal, X } from 'lucide-react'
import { ConsentBanner } from './components/ConsentBanner'
import { InsightDeck } from './components/InsightDeck'
import { RubricBoard } from './components/RubricBoard'
import { TopBar } from './components/TopBar'
import { TranscriptFeed } from './components/TranscriptFeed'
import {
  createInsightFromSignal,
  createTranscriptItem,
  getStarterInsights,
  initialRubric,
  initialTranscript,
  type CaptureState,
  type InsightCard,
  type InterviewMode,
  type RubricItem,
  type TranscriptItem
} from './lib/session'
import {
  createDemoRecognitionLoop,
  startBrowserSpeechRecognition,
  startMicrophoneCapture,
  startScreenCapture,
  stopMediaStream,
  supportsBrowserSpeechRecognition,
  type CaptureHandles
} from './lib/recognition'

const emptyCapture: CaptureState = {
  running: false,
  screen: false,
  microphone: false,
  speechRecognition: false
}

export function App() {
  const isOverlay = window.location.hash.includes('/overlay')
  const [mode, setMode] = useState<InterviewMode>('oral')
  const [consentAccepted, setConsentAccepted] = useState(false)
  const [capture, setCapture] = useState<CaptureState>(emptyCapture)
  const [transcript, setTranscript] = useState<TranscriptItem[]>(initialTranscript)
  const [insights, setInsights] = useState<InsightCard[]>(getStarterInsights())
  const [rubric, setRubric] = useState<RubricItem[]>(initialRubric)
  const [manualSignal, setManualSignal] = useState('')
  const handlesRef = useRef<CaptureHandles>({})
  const demoStopRef = useRef<(() => void) | null>(null)

  const exportPayload = useMemo(
    () => ({
      mode,
      createdAt: new Date().toISOString(),
      rubric,
      transcript,
      insights
    }),
    [insights, mode, rubric, transcript]
  )

  useEffect(() => {
    return () => stopCapture()
  }, [])

  function appendSignal(item: TranscriptItem): void {
    setTranscript((current) => [item, ...current].slice(0, 80))
    setInsights((current) => [createInsightFromSignal(item, mode), ...current].slice(0, 12))
  }

  async function startCapture(): Promise<void> {
    setCapture({ running: true, screen: false, microphone: false, speechRecognition: false })

    try {
      const wantsScreen = mode !== 'oral'
      const wantsMic = mode !== 'screen-text'

      if (wantsScreen) {
        handlesRef.current.screenStream = await startScreenCapture()
      }

      if (wantsMic) {
        handlesRef.current.microphoneStream = await startMicrophoneCapture()
      }

      if (wantsMic && supportsBrowserSpeechRecognition()) {
        handlesRef.current.speechStop = startBrowserSpeechRecognition(
          'ru-RU',
          appendSignal,
          (message) => setCapture((current) => ({ ...current, error: message }))
        )
      }

      demoStopRef.current = createDemoRecognitionLoop(mode, ({ item }) => appendSignal(item))

      setCapture({
        running: true,
        screen: Boolean(handlesRef.current.screenStream),
        microphone: Boolean(handlesRef.current.microphoneStream),
        speechRecognition: Boolean(handlesRef.current.speechStop)
      })
    } catch (error) {
      demoStopRef.current = createDemoRecognitionLoop(mode, ({ item }) => appendSignal(item))
      setCapture({
        running: true,
        screen: false,
        microphone: false,
        speechRecognition: false,
        error: error instanceof Error ? error.message : 'Capture failed'
      })
    }
  }

  function stopCapture(): void {
    demoStopRef.current?.()
    demoStopRef.current = null
    handlesRef.current.speechStop?.()
    stopMediaStream(handlesRef.current.screenStream)
    stopMediaStream(handlesRef.current.microphoneStream)
    handlesRef.current = {}
    setCapture(emptyCapture)
  }

  function submitManualSignal(): void {
    const text = manualSignal.trim()
    if (!text) {
      return
    }

    appendSignal(createTranscriptItem(mode, text, 'manual'))
    setManualSignal('')
  }

  function updateRubric(id: string, score: number): void {
    setRubric((items) => items.map((item) => (item.id === id ? { ...item, score } : item)))
  }

  async function copyExport(): Promise<void> {
    await navigator.clipboard.writeText(JSON.stringify(exportPayload, null, 2))
  }

  function downloadExport(): void {
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `interview-session-${Date.now()}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (isOverlay) {
    return (
      <main className="overlay-shell">
        <div className="overlay-handle">
          <Move size={16} aria-hidden="true" />
          <span>Assessor overlay</span>
          <button type="button" onClick={() => window.assessor?.closeOverlay()} aria-label="Close overlay">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <InsightDeck insights={insights} />
      </main>
    )
  }

  return (
    <main className="app-shell">
      <TopBar
        mode={mode}
        capture={capture}
        consentAccepted={consentAccepted}
        onModeChange={(nextMode) => {
          if (capture.running) {
            stopCapture()
          }
          setMode(nextMode)
        }}
        onStart={startCapture}
        onStop={stopCapture}
        onOpenOverlay={() => window.assessor?.openOverlay()}
      />

      <ConsentBanner accepted={consentAccepted} onChange={setConsentAccepted} />

      {capture.error ? (
        <section className="capture-note" aria-label="Capture issue">
          <LockKeyhole size={17} aria-hidden="true" />
          <span>{capture.error}</span>
        </section>
      ) : null}

      <section className="workspace-grid">
        <div className="left-stack">
          <InsightDeck insights={insights} />
          <RubricBoard items={rubric} onChange={updateRubric} />
        </div>

        <TranscriptFeed items={transcript} />

        <aside className="panel notes-panel" aria-label="Manual signal">
          <header className="panel-header">
            <div>
              <p className="eyebrow">Notes</p>
              <h2>Ручной сигнал</h2>
            </div>
            <FileText size={20} aria-hidden="true" />
          </header>

          <textarea
            value={manualSignal}
            onChange={(event) => setManualSignal(event.target.value)}
            placeholder="Вставь вопрос, OCR-фрагмент или заметку..."
          />

          <div className="notes-actions">
            <button type="button" className="secondary-button" onClick={copyExport}>
              <Copy size={16} aria-hidden="true" />
              Copy JSON
            </button>
            <button type="button" className="secondary-button" onClick={downloadExport}>
              <Download size={16} aria-hidden="true" />
              Export
            </button>
            <button type="button" className="primary-button" onClick={submitManualSignal}>
              <SendHorizontal size={16} aria-hidden="true" />
              Add
            </button>
          </div>
        </aside>
      </section>
    </main>
  )
}

