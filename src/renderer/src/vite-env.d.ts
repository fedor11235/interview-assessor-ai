/// <reference types="vite/client" />

interface Window {
  assessor?: {
    platform: NodeJS.Platform
    openOverlay: () => Promise<void>
    closeOverlay: () => Promise<void>
    setOverlayPassThrough: (enabled: boolean) => Promise<void>
  }
  webkitSpeechRecognition?: SpeechRecognitionConstructor
  SpeechRecognition?: SpeechRecognitionConstructor
}

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
