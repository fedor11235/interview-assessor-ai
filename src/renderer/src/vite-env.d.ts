/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ASSISTANT_API_URL?: string
  readonly VITE_ASSISTANT_API_TOKEN?: string
  readonly VITE_ASSISTANT_API_TIMEOUT_MS?: string
  readonly VITE_SCREEN_ANALYSIS_INTERVAL_MS?: string
}

interface Window {
  assessor?: {
    platform: NodeJS.Platform
    listCaptureSources: () => Promise<CaptureSourceDescriptor[]>
    getScreenAccessStatus: () => Promise<ScreenAccessStatus>
    openScreenSettings: () => Promise<void>
    openOverlay: () => Promise<void>
    closeOverlay: () => Promise<void>
    getOverlaySnapshot: () => Promise<unknown>
    updateOverlay: (snapshot: unknown) => Promise<void>
    onOverlaySnapshot: (callback: (snapshot: unknown) => void) => () => void
    setOverlayPassThrough: (enabled: boolean) => Promise<void>
  }
  webkitSpeechRecognition?: SpeechRecognitionConstructor
  SpeechRecognition?: SpeechRecognitionConstructor
}

interface CaptureSourceDescriptor {
  id: string
  name: string
  kind: 'window' | 'screen'
  thumbnail: string
  appIcon?: string
}

type ScreenAccessStatus = 'not-determined' | 'granted' | 'denied' | 'restricted' | 'unknown'

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
}

interface SpeechRecognitionEvent {
  resultIndex: number
  results: SpeechRecognitionResultList
}

interface SpeechRecognitionErrorEvent {
  error: string
  message?: string
}
