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
import { SourcePicker } from './components/SourcePicker'
import { TopBar } from './components/TopBar'
import { TranscriptFeed } from './components/TranscriptFeed'
import {
  requestAssistantAnswer,
  type AssistantApiState
} from './lib/assistantApi'
import {
  createInsightFromSignal,
  createTranscriptItem,
  getStarterInsights,
  initialTranscript,
  type CaptureState,
  type InsightCard,
  type InterviewMode,
  type OutputMode,
  type QuestionMode,
  type TranscriptItem
} from './lib/session'
import {
  startBrowserSpeechRecognition,
  startMicrophoneCapture,
  startScreenCapture,
  startScreenFrameAnalysis,
  stopMediaStream,
  supportsBrowserSpeechRecognition,
  type CaptureHandles
} from './lib/recognition'
import { speakInsight, stopSpeechOutput } from './lib/speechOutput'

const emptyCapture: CaptureState = {
  running: false,
  screen: false,
  microphone: false,
  speechRecognition: false
}

const idleApiState: AssistantApiState = {
  status: 'idle',
  message: 'API готов к локальному серверу'
}

interface PendingFrame {
  item: TranscriptItem
  imageDataUrl: string
  token: number
}

interface OverlaySnapshot {
  mode: InterviewMode
  questionMode: QuestionMode
  outputMode: OutputMode
  capture: CaptureState
  apiState: AssistantApiState
  insights: InsightCard[]
  sourceName?: string
  latestSignal?: TranscriptItem
  updatedAt: string
}

export function App() {
  const isOverlay = window.location.hash.includes('/overlay')
  const [mode, setMode] = useState<InterviewMode>('oral')
  const [questionMode, setQuestionMode] = useState<QuestionMode>('test')
  const [outputMode, setOutputMode] = useState<OutputMode>('overlay')
  const [apiState, setApiState] = useState<AssistantApiState>(idleApiState)
  const [consentAccepted, setConsentAccepted] = useState(false)
  const [capture, setCapture] = useState<CaptureState>(emptyCapture)
  const [transcript, setTranscript] = useState<TranscriptItem[]>(initialTranscript)
  const [insights, setInsights] = useState<InsightCard[]>(getStarterInsights())
  const [manualSignal, setManualSignal] = useState('')
  const [captureSources, setCaptureSources] = useState<CaptureSourceDescriptor[]>([])
  const [selectedSourceId, setSelectedSourceId] = useState<string>()
  const [systemPickedSourceName, setSystemPickedSourceName] = useState('')
  const [sourceLoading, setSourceLoading] = useState(false)
  const [sourceError, setSourceError] = useState<string>()
  const [screenAccessStatus, setScreenAccessStatus] = useState<ScreenAccessStatus>('unknown')
  const [overlaySourceName, setOverlaySourceName] = useState('')
  const handlesRef = useRef<CaptureHandles>({})
  const transcriptRef = useRef<TranscriptItem[]>(initialTranscript)
  const outputModeRef = useRef<OutputMode>('overlay')
  const modeRef = useRef<InterviewMode>('oral')
  const questionModeRef = useRef<QuestionMode>('test')
  const requestSeqRef = useRef(0)
  const sessionIdRef = useRef(crypto.randomUUID())
  const screenAnalysisInFlightRef = useRef(false)
  const pendingScreenFrameRef = useRef<PendingFrame | null>(null)
  const latestScreenTokenRef = useRef(0)

  useEffect(() => {
    document.body.dataset.route = isOverlay ? 'overlay' : 'app'

    return () => {
      delete document.body.dataset.route
    }
  }, [isOverlay])

  const exportPayload = useMemo(
    () => ({
      mode,
      questionMode,
      outputMode,
      createdAt: new Date().toISOString(),
      transcript,
      insights
    }),
    [insights, mode, outputMode, questionMode, transcript]
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
    transcriptRef.current = transcript
  }, [transcript])

  useEffect(() => {
    outputModeRef.current = outputMode
  }, [outputMode])

  useEffect(() => {
    modeRef.current = mode
  }, [mode])

  useEffect(() => {
    questionModeRef.current = questionMode
  }, [questionMode])

  useEffect(() => {
    if (isOverlay || !capture.running) {
      return
    }

    if (shouldShowOverlay(outputMode)) {
      void window.assessor?.openOverlay()
      return
    }

    void window.assessor?.closeOverlay()
  }, [capture.running, isOverlay, outputMode])

  useEffect(() => {
    if (!isOverlay) {
      return
    }

    const applySnapshot = (snapshot: unknown): void => {
      if (!isOverlaySnapshot(snapshot)) {
        return
      }

      setMode(snapshot.mode)
      setQuestionMode(isQuestionMode(snapshot.questionMode) ? snapshot.questionMode : 'test')
      setOutputMode(isOutputMode(snapshot.outputMode) ? snapshot.outputMode : 'overlay')
      setCapture(snapshot.capture)
      setApiState(isApiState(snapshot.apiState) ? snapshot.apiState : idleApiState)
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
  }, [
    apiState,
    capture,
    captureSources,
    insights,
    isOverlay,
    mode,
    outputMode,
    questionMode,
    selectedSourceId,
    systemPickedSourceName,
    transcript
  ])

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

  function queueScreenFrame(item: TranscriptItem, imageDataUrl: string): void {
    const token = latestScreenTokenRef.current + 1
    latestScreenTokenRef.current = token
    transcriptRef.current = [item]
    setTranscript([item])
    setInsights([])

    if (screenAnalysisInFlightRef.current) {
      pendingScreenFrameRef.current = { item, imageDataUrl, token }
      setApiState({
        status: 'thinking',
        message: 'Новый кадр найден. Старый ответ будет проигнорирован.'
      })
      return
    }

    void appendSignal(item, imageDataUrl, token)
  }

  async function appendSignal(item: TranscriptItem, imageDataUrl?: string, screenToken?: number): Promise<void> {
    if (screenToken) {
      screenAnalysisInFlightRef.current = true
    }

    const isScreenFrame = item.source === 'screen' && Boolean(imageDataUrl)
    const previousTranscript = isScreenFrame ? [] : transcriptRef.current
    const nextTranscript = isScreenFrame ? [item] : [item, ...previousTranscript].slice(0, 80)
    transcriptRef.current = nextTranscript
    setTranscript(nextTranscript)
    if (isScreenFrame) {
      setInsights([])
    }
    setApiState({ status: 'thinking', message: 'Отправляю сигнал на локальный API...' })

    const requestId = requestSeqRef.current + 1
    requestSeqRef.current = requestId

    try {
      const answer = await requestAssistantAnswer({
        sessionId: sessionIdRef.current,
        mode: modeRef.current,
        questionMode: questionModeRef.current,
        outputMode: outputModeRef.current,
        signal: { ...item, imageDataUrl },
        context: {
          sourceName: getSelectedSourceName(),
          recentTranscript: isScreenFrame ? [] : previousTranscript.slice(0, 10)
        }
      })

      if (
        requestSeqRef.current !== requestId ||
        (screenToken && screenToken !== latestScreenTokenRef.current)
      ) {
        return
      }

      const nextInsights = answer.insights.slice(0, 12)
      setInsights(nextInsights)
      updateTranscriptText(item.id, answer.observedText)
      setApiState({
        status: 'online',
        message: answer.model
          ? `${answer.model}${answer.latencyMs ? ` · ${answer.latencyMs} ms` : ''}`
          : 'Ответ получен от API'
      })
      deliverInsight(nextInsights[0])
    } catch (error) {
      if (
        requestSeqRef.current !== requestId ||
        (screenToken && screenToken !== latestScreenTokenRef.current)
      ) {
        return
      }

      const fallback = markFallback(createInsightFromSignal(item, modeRef.current))
      setInsights((current) => (isScreenFrame ? [fallback] : [fallback, ...current].slice(0, 12)))
      setApiState({
        status: 'offline',
        message:
          error instanceof Error
            ? `API недоступен: ${error.message}`
            : 'API недоступен, показан локальный fallback'
      })
      deliverInsight(fallback)
    } finally {
      if (screenToken) {
        screenAnalysisInFlightRef.current = false
        const pendingFrame = pendingScreenFrameRef.current

        if (pendingFrame) {
          pendingScreenFrameRef.current = null
          void appendSignal(pendingFrame.item, pendingFrame.imageDataUrl, pendingFrame.token)
        }
      }
    }
  }

  async function startCapture(): Promise<void> {
    const wantsScreen = mode !== 'oral'
    const wantsMic = mode !== 'screen-text'

    try {
      if (wantsScreen) {
        setTranscript([])
        setInsights([])
      }

      setCapture({ running: true, screen: false, microphone: false, speechRecognition: false })

      if (wantsScreen) {
        handlesRef.current.screenStream = await startScreenCapture(selectedSourceId)
        const pickedTrack = handlesRef.current.screenStream.getVideoTracks()[0]
        setSystemPickedSourceName(pickedTrack?.label || 'Выбранное окно')
        handlesRef.current.screenAnalysisStop = startScreenFrameAnalysis(
          handlesRef.current.screenStream,
          mode,
          queueScreenFrame,
          (message) => setCapture((current) => ({ ...current, error: message }))
        )
      }

      if (wantsMic) {
        handlesRef.current.microphoneStream = await startMicrophoneCapture()
      }

      if (wantsMic && supportsBrowserSpeechRecognition()) {
        handlesRef.current.speechStop = startBrowserSpeechRecognition(
          'ru-RU',
          (item) => void appendSignal(item),
          (message) => setCapture((current) => ({ ...current, error: message }))
        )
      }

      if (shouldShowOverlay(outputModeRef.current)) {
        void window.assessor?.openOverlay()
      }

      setCapture({
        running: true,
        screen: Boolean(handlesRef.current.screenStream),
        microphone: Boolean(handlesRef.current.microphoneStream),
        speechRecognition: Boolean(handlesRef.current.speechStop)
      })
    } catch (error) {
      setCapture({
        running: false,
        screen: false,
        microphone: false,
        speechRecognition: false,
        error: error instanceof Error ? error.message : 'Capture failed'
      })
    }
  }

  function stopCapture(): void {
    handlesRef.current.speechStop?.()
    handlesRef.current.screenAnalysisStop?.()
    pendingScreenFrameRef.current = null
    screenAnalysisInFlightRef.current = false
    latestScreenTokenRef.current += 1
    stopMediaStream(handlesRef.current.screenStream)
    stopMediaStream(handlesRef.current.microphoneStream)
    stopSpeechOutput()
    handlesRef.current = {}
    setSystemPickedSourceName('')
    setCapture(emptyCapture)
    void window.assessor?.updateOverlay({ ...createOverlaySnapshot(), capture: emptyCapture })
  }

  function createOverlaySnapshot(): OverlaySnapshot {
    return {
      mode,
      questionMode,
      outputMode,
      capture,
      apiState,
      insights,
      sourceName: getSelectedSourceName(),
      latestSignal: transcript[0],
      updatedAt: new Date().toISOString()
    }
  }

  function getSelectedSourceName(): string | undefined {
    return systemPickedSourceName || captureSources.find((source) => source.id === selectedSourceId)?.name
  }

  function submitManualSignal(): void {
    const text = manualSignal.trim()
    if (!text) {
      return
    }

    void appendSignal(createTranscriptItem(mode, text, 'manual'))
    setManualSignal('')
  }

  function updateTranscriptText(id: string, text?: string): void {
    const nextText = text?.trim()
    if (!nextText) {
      return
    }

    const nextTranscript = transcriptRef.current.map((item) =>
      item.id === id ? { ...item, text: nextText } : item
    )
    transcriptRef.current = nextTranscript
    setTranscript(nextTranscript)
  }

  function deliverInsight(insight?: InsightCard): void {
    if (!insight) {
      return
    }

    const currentOutputMode = outputModeRef.current

    if (shouldShowOverlay(currentOutputMode)) {
      void window.assessor?.openOverlay()
    }

    if (currentOutputMode === 'audio' || currentOutputMode === 'both') {
      const spoken = speakInsight(insight)
      if (!spoken) {
        setApiState((current) => ({
          ...current,
          message: `${current.message}. Озвучка недоступна в этом окружении.`
        }))
      }
    }
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
        <section className="overlay-answer-panel" aria-label="AI overlay answers">
          <div className="overlay-handle">
            <Move size={16} aria-hidden="true" />
            <span>AI ответы</span>
            <button type="button" onClick={() => window.assessor?.closeOverlay()} aria-label="Close overlay">
              <X size={16} aria-hidden="true" />
            </button>
          </div>

          <header className="overlay-status">
            <span className={apiState.status === 'thinking' ? 'overlay-dot pulse' : capture.running ? 'overlay-dot active' : 'overlay-dot'} />
            <strong>{getOverlayStatusTitle(apiState.status, capture.running)}</strong>
            <em>{overlaySourceName || mode}</em>
          </header>

          <p className={`overlay-api-message overlay-api-${apiState.status}`}>
            {apiState.message}
          </p>

          {latestSignal ? (
            <article className="overlay-signal">
              <MessageSquareText size={17} aria-hidden="true" />
              <p>{latestSignal.text}</p>
            </article>
          ) : null}

          {apiState.status === 'thinking' ? (
            <article className="overlay-answer-card overlay-answer-thinking">
              <div className="overlay-answer-icon">
                <Sparkles size={20} aria-hidden="true" />
              </div>
              <div>
                <div className="overlay-answer-title">
                  <h1>Анализирую окно</h1>
                  <span>до 35 сек</span>
                </div>
                <p>Обычно это занимает 3-12 секунд. Если дольше, сработает таймаут и я покажу причину.</p>
              </div>
            </article>
          ) : primaryInsight ? (
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
        questionMode={questionMode}
        outputMode={outputMode}
        capture={capture}
        apiState={apiState}
        consentAccepted={consentAccepted}
        onModeChange={(nextMode) => {
          if (capture.running) {
            stopCapture()
          }
          setMode(nextMode)
        }}
        onQuestionModeChange={setQuestionMode}
        onOutputModeChange={setOutputMode}
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
              selectedSourceName={getSelectedSourceName()}
              accessStatus={screenAccessStatus}
              disabled={capture.running || !consentAccepted}
              loading={sourceLoading}
              error={sourceError}
              onRefresh={refreshCaptureSources}
              onChooseWindow={startCapture}
              onOpenScreenSettings={() => void window.assessor?.openScreenSettings()}
              onSelect={setSelectedSourceId}
            />
          ) : null}
          <InsightDeck insights={insights} />
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

          <p className={`api-note api-note-${apiState.status}`}>{apiState.message}</p>

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

function shouldShowOverlay(outputMode: OutputMode): boolean {
  return outputMode === 'overlay' || outputMode === 'both'
}

function markFallback(insight: InsightCard): InsightCard {
  return {
    ...insight,
    id: crypto.randomUUID(),
    title: `Локальный fallback: ${insight.title}`,
    confidence: Math.min(insight.confidence, 0.62)
  }
}

function getOverlayStatusTitle(status: AssistantApiState['status'], running: boolean): string {
  if (status === 'thinking') {
    return 'AI анализирует'
  }

  if (status === 'offline') {
    return 'API недоступен'
  }

  if (status === 'online') {
    return 'AI ответил'
  }

  return running ? 'Live overlay' : 'Overlay ready'
}

function isOverlaySnapshot(value: unknown): value is OverlaySnapshot {
  if (!value || typeof value !== 'object') {
    return false
  }

  const snapshot = value as Partial<OverlaySnapshot>
  return Array.isArray(snapshot.insights) && typeof snapshot.mode === 'string'
}

function isOutputMode(value: unknown): value is OutputMode {
  return value === 'overlay' || value === 'audio' || value === 'both'
}

function isQuestionMode(value: unknown): value is QuestionMode {
  return value === 'test' || value === 'question'
}

function isApiState(value: unknown): value is AssistantApiState {
  if (!value || typeof value !== 'object') {
    return false
  }

  const state = value as Partial<AssistantApiState>
  return typeof state.message === 'string' && typeof state.status === 'string'
}
