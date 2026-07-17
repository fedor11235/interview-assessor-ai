import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  FileText,
  LockKeyhole,
  MessageSquareText,
  Move,
  SendHorizontal,
  Sparkles,
  X
} from 'lucide-react'
import { ConsentBanner } from './components/ConsentBanner'
import { InsightDeck } from './components/InsightDeck'
import { RubricBoard } from './components/RubricBoard'
import { SourcePicker } from './components/SourcePicker'
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

interface OverlaySnapshot {
  mode: InterviewMode
  capture: CaptureState
  insights: InsightCard[]
  sourceName?: string
  latestSignal?: TranscriptItem
  updatedAt: string
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
  const [captureSources, setCaptureSources] = useState<CaptureSourceDescriptor[]>([])
  const [selectedSourceId, setSelectedSourceId] = useState<string>()
  const [sourceLoading, setSourceLoading] = useState(false)
  const [sourceError, setSourceError] = useState<string>()
  const [screenAccessStatus, setScreenAccessStatus] = useState<ScreenAccessStatus>('unknown')
  const [overlaySourceName, setOverlaySourceName] = useState('')
  const handlesRef = useRef<CaptureHandles>({})
  const demoStopRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    document.body.dataset.route = isOverlay ? 'overlay' : 'app'

    return () => {
      delete document.body.dataset.route
    }
  }, [isOverlay])

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

  useEffect(() => {
    if (!isOverlay) {
      void refreshCaptureSources()
    }
  }, [isOverlay])

  useEffect(() => {
    if (!isOverlay) {
      return
    }

    const applySnapshot = (snapshot: unknown): void => {
      if (!isOverlaySnapshot(snapshot)) {
        return
      }

      setMode(snapshot.mode)
      setCapture(snapshot.capture)
      setInsights(snapshot.insights)
      setTranscript(snapshot.latestSignal ? [snapshot.latestSignal] : [])
      setOverlaySourceName(snapshot.sourceName ?? '')
    }

    void window.assessor?.getOverlaySnapshot().then(applySnapshot)
    return window.assessor?.onOverlaySnapshot(applySnapshot)
  }, [isOverlay])

  useEffect(() => {
    if (isOverlay) {
      return
    }

    void window.assessor?.updateOverlay(createOverlaySnapshot())
  }, [capture, captureSources, insights, isOverlay, mode, selectedSourceId, transcript])

  async function refreshCaptureSources(): Promise<CaptureSourceDescriptor[]> {
    setSourceLoading(true)
    setSourceError(undefined)

    if (!window.assessor) {
      setSourceError('Список окон доступен только в Electron-приложении, не в браузерном preview.')
      setSourceLoading(false)
      return []
    }

    try {
      const accessStatus = await window.assessor?.getScreenAccessStatus()
      if (accessStatus) {
        setScreenAccessStatus(accessStatus)
      }

      const sources = await window.assessor?.listCaptureSources()
      const nextSources = sortCaptureSources(sources ?? [])
      setCaptureSources(nextSources)

      setSelectedSourceId((current) => {
        if (current && nextSources.some((source) => source.id === current)) {
          return current
        }

        return getPreferredSource(nextSources)?.id
      })

      return nextSources
    } catch (error) {
      setSourceError(
        error instanceof Error ? error.message : 'Не удалось получить список окон.'
      )
      return []
    } finally {
      setSourceLoading(false)
    }
  }

  function appendSignal(item: TranscriptItem): void {
    setTranscript((current) => [item, ...current].slice(0, 80))
    setInsights((current) => [createInsightFromSignal(item, mode), ...current].slice(0, 12))
  }

  async function startCapture(): Promise<void> {
    const wantsScreen = mode !== 'oral'
    const wantsMic = mode !== 'screen-text'

    try {
      setCapture({ running: true, screen: false, microphone: false, speechRecognition: false })
      void window.assessor?.openOverlay()

      if (wantsScreen) {
        handlesRef.current.screenStream = await startScreenCapture(selectedSourceId)
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
      if (!wantsScreen) {
        demoStopRef.current = createDemoRecognitionLoop(mode, ({ item }) => appendSignal(item))
      }

      setCapture({
        running: !wantsScreen,
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
    void window.assessor?.updateOverlay({ ...createOverlaySnapshot(), capture: emptyCapture })
  }

  function createOverlaySnapshot(): OverlaySnapshot {
    return {
      mode,
      capture,
      insights,
      sourceName: getSelectedSourceName(),
      latestSignal: transcript[0],
      updatedAt: new Date().toISOString()
    }
  }

  function getSelectedSourceName(): string | undefined {
    return captureSources.find((source) => source.id === selectedSourceId)?.name
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
    const primaryInsight = insights[0]
    const latestSignal = transcript[0]

    return (
      <main className="overlay-shell">
        <div className="overlay-handle">
          <Move size={16} aria-hidden="true" />
          <span>AI ответы поверх экрана</span>
          <button type="button" onClick={() => window.assessor?.closeOverlay()} aria-label="Close overlay">
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <section className="overlay-answer-panel" aria-label="AI overlay answers">
          <header className="overlay-status">
            <span className={capture.running ? 'overlay-dot active' : 'overlay-dot'} />
            <strong>{capture.running ? 'Live overlay' : 'Overlay ready'}</strong>
            <em>{overlaySourceName || mode}</em>
          </header>

          {latestSignal ? (
            <article className="overlay-signal">
              <MessageSquareText size={17} aria-hidden="true" />
              <p>{latestSignal.text}</p>
            </article>
          ) : null}

          {primaryInsight ? (
            <article className={`overlay-answer-card overlay-answer-${primaryInsight.kind}`}>
              <div className="overlay-answer-icon">
                <Sparkles size={20} aria-hidden="true" />
              </div>
              <div>
                <div className="overlay-answer-title">
                  <h1>{primaryInsight.title}</h1>
                  <span>{Math.round(primaryInsight.confidence * 100)}%</span>
                </div>
                <p>{primaryInsight.body}</p>
              </div>
            </article>
          ) : (
            <article className="overlay-empty">
              <Sparkles size={20} aria-hidden="true" />
              <p>Ожидаю вопрос или текст с экрана.</p>
            </article>
          )}

          <div className="overlay-mini-list">
            {insights.slice(1, 4).map((insight) => (
              <article key={insight.id}>
                {insight.kind === 'risk' ? (
                  <AlertTriangle size={16} aria-hidden="true" />
                ) : (
                  <CheckCircle2 size={16} aria-hidden="true" />
                )}
                <span>{insight.body}</span>
              </article>
            ))}
          </div>
        </section>
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
          {mode !== 'oral' ? (
            <SourcePicker
              sources={captureSources}
              selectedSourceId={selectedSourceId}
              accessStatus={screenAccessStatus}
              disabled={capture.running}
              loading={sourceLoading}
              error={sourceError}
              onRefresh={refreshCaptureSources}
              onOpenScreenSettings={() => void window.assessor?.openScreenSettings()}
              onSelect={setSelectedSourceId}
            />
          ) : null}
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

function sortCaptureSources(sources: CaptureSourceDescriptor[]): CaptureSourceDescriptor[] {
  return [...sources].sort((first, second) => {
    if (first.kind !== second.kind) {
      return first.kind === 'window' ? -1 : 1
    }

    return first.name.localeCompare(second.name)
  })
}

function getPreferredSource(sources: CaptureSourceDescriptor[]): CaptureSourceDescriptor | undefined {
  return (
    sources.find(
      (source) =>
        source.kind === 'window' &&
        !source.name.toLowerCase().includes('interview assessor') &&
        !source.name.toLowerCase().includes('electron')
    ) ??
    sources.find((source) => source.kind === 'window') ??
    sources[0]
  )
}

function isOverlaySnapshot(value: unknown): value is OverlaySnapshot {
  if (!value || typeof value !== 'object') {
    return false
  }

  const snapshot = value as Partial<OverlaySnapshot>
  return Array.isArray(snapshot.insights) && typeof snapshot.mode === 'string'
}
