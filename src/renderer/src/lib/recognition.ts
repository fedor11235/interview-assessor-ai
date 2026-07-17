import { createTranscriptItem, type InterviewMode, type TranscriptItem } from './session'

export interface CaptureHandles {
  screenStream?: MediaStream
  microphoneStream?: MediaStream
  speechStop?: () => void
  screenAnalysisStop?: () => void
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

export function startScreenFrameAnalysis(
  stream: MediaStream,
  mode: InterviewMode,
  onFrame: (item: TranscriptItem, imageDataUrl: string) => void,
  onError: (message: string) => void
): () => void {
  const video = document.createElement('video')
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d', { willReadFrequently: true })
  const intervalMs = Number(import.meta.env.VITE_SCREEN_ANALYSIS_INTERVAL_MS ?? 8000)
  let previousFrame: ImageData | undefined
  let intervalId: number | undefined
  let timeoutId: number | undefined
  let stopped = false

  video.muted = true
  video.playsInline = true
  video.srcObject = stream

  const captureFrame = (): void => {
    if (stopped || !context || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      return
    }

    const sourceWidth = video.videoWidth
    const sourceHeight = video.videoHeight

    if (!sourceWidth || !sourceHeight) {
      return
    }

    const maxWidth = 1280
    const scale = Math.min(1, maxWidth / sourceWidth)
    canvas.width = Math.max(1, Math.round(sourceWidth * scale))
    canvas.height = Math.max(1, Math.round(sourceHeight * scale))
    context.drawImage(video, 0, 0, canvas.width, canvas.height)

    const nextFrame = context.getImageData(0, 0, canvas.width, canvas.height)
    const delta = extractFrameDeltaScore(previousFrame, nextFrame)
    previousFrame = nextFrame

    if (delta < 0.006) {
      return
    }

    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.72)
    onFrame(createTranscriptItem(mode, 'Кадр выбранного окна отправлен на анализ.', 'screen'), imageDataUrl)
  }

  void video
    .play()
    .then(() => {
      timeoutId = window.setTimeout(captureFrame, 900)
      intervalId = window.setInterval(captureFrame, Number.isFinite(intervalMs) ? intervalMs : 8000)
    })
    .catch((error) => {
      onError(error instanceof Error ? error.message : 'Не удалось прочитать кадр выбранного окна.')
    })

  return () => {
    stopped = true
    if (timeoutId) {
      window.clearTimeout(timeoutId)
    }
    if (intervalId) {
      window.clearInterval(intervalId)
    }
    video.pause()
    video.srcObject = null
  }
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
