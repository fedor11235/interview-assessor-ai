import { createTranscriptItem, demoQuestions, type InterviewMode, type TranscriptItem } from './session'

export interface CaptureHandles {
  screenStream?: MediaStream
  microphoneStream?: MediaStream
  speechStop?: () => void
}

export interface RecognitionTick {
  item: TranscriptItem
  raw: string
}

export function supportsBrowserSpeechRecognition(): boolean {
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)
}

export async function startScreenCapture(sourceId?: string): Promise<MediaStream> {
  if (!navigator.mediaDevices) {
    throw new Error('Screen capture is not available in this environment.')
  }

  if (sourceId) {
    return navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: sourceId,
          maxFrameRate: 12
        }
      } as unknown as MediaTrackConstraints
    })
  }

  if (!navigator.mediaDevices.getDisplayMedia) {
    throw new Error('Screen capture picker is not available in this environment.')
  }

  return navigator.mediaDevices.getDisplayMedia({
    video: {
      frameRate: { ideal: 8, max: 12 }
    },
    audio: false
  })
}

export async function startMicrophoneCapture(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Microphone capture is not available in this environment.')
  }

  return navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    }
  })
}

export function stopMediaStream(stream?: MediaStream): void {
  stream?.getTracks().forEach((track) => track.stop())
}

export function startBrowserSpeechRecognition(
  locale: string,
  onText: (item: TranscriptItem) => void,
  onError: (message: string) => void
): () => void {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition

  if (!Recognition) {
    onError('Browser speech recognition is not available.')
    return () => undefined
  }

  const recognition = new Recognition()
  recognition.continuous = true
  recognition.interimResults = true
  recognition.lang = locale

  recognition.onresult = (event) => {
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index]
      if (result.isFinal && result[0]?.transcript.trim()) {
        onText(createTranscriptItem('oral', result[0].transcript.trim(), 'microphone'))
      }
    }
  }

  recognition.onerror = (event) => {
    onError(event.message || event.error)
  }

  recognition.start()
  return () => recognition.stop()
}

export function createDemoRecognitionLoop(
  mode: InterviewMode,
  onTick: (tick: RecognitionTick) => void
): () => void {
  let index = 0
  const interval = window.setInterval(() => {
    const raw = demoQuestions[mode][index % demoQuestions[mode].length]
    const item = createTranscriptItem(mode, raw)
    onTick({ item, raw })
    index += 1
  }, 3600)

  return () => window.clearInterval(interval)
}

export function extractFrameDeltaScore(previous?: ImageData, next?: ImageData): number {
  if (!previous || !next || previous.data.length !== next.data.length) {
    return 1
  }

  let changed = 0
  const step = 16

  for (let index = 0; index < next.data.length; index += step) {
    const diff = Math.abs(next.data[index] - previous.data[index])
    if (diff > 22) {
      changed += 1
    }
  }

  return changed / (next.data.length / step)
}
