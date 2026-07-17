import type { InsightCard, InterviewMode, OutputMode, TranscriptItem } from './session'

export type AssistantApiStatus = 'idle' | 'thinking' | 'online' | 'offline'

export interface AssistantApiState {
  status: AssistantApiStatus
  message: string
}

export interface AssistantApiRequest {
  sessionId: string
  mode: InterviewMode
  outputMode: OutputMode
  signal: TranscriptItem & {
    imageDataUrl?: string
  }
  context: {
    sourceName?: string
    recentTranscript: TranscriptItem[]
  }
}

export interface AssistantApiResponse {
  insights: InsightCard[]
  observedText?: string
  model?: string
  latencyMs?: number
}

interface RawAssistantResponse {
  insights?: unknown
  answer?: unknown
  title?: unknown
  kind?: unknown
  confidence?: unknown
  observedText?: unknown
  model?: unknown
  latencyMs?: unknown
}

const DEFAULT_API_URL = 'http://localhost:3011/api/answer'
const DEFAULT_TIMEOUT_MS = 35000

export async function requestAssistantAnswer(request: AssistantApiRequest): Promise<AssistantApiResponse> {
  const endpoint = import.meta.env.VITE_ASSISTANT_API_URL || DEFAULT_API_URL
  const token = import.meta.env.VITE_ASSISTANT_API_TOKEN
  const timeoutMs = getApiTimeoutMs()
  const startedAt = performance.now()
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(request),
      signal: controller.signal
    })

    const payload = (await response.json().catch(() => ({}))) as RawAssistantResponse & {
      error?: string
    }

    if (!response.ok) {
      throw new Error(payload.error || `Assistant API returned ${response.status}`)
    }

    return normalizeAssistantResponse(payload, Math.round(performance.now() - startedAt))
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`API не ответил за ${Math.round(timeoutMs / 1000)} сек. Проверь ключ, сеть или модель.`)
    }

    throw error
  } finally {
    window.clearTimeout(timeoutId)
  }
}

function normalizeAssistantResponse(payload: RawAssistantResponse, measuredLatencyMs: number): AssistantApiResponse {
  const insights = normalizeInsights(payload)

  if (!insights.length) {
    throw new Error('Assistant API returned no usable answer.')
  }

  return {
    insights,
    observedText: typeof payload.observedText === 'string' ? payload.observedText : undefined,
    model: typeof payload.model === 'string' ? payload.model : undefined,
    latencyMs: typeof payload.latencyMs === 'number' ? payload.latencyMs : measuredLatencyMs
  }
}

function normalizeInsights(payload: RawAssistantResponse): InsightCard[] {
  if (Array.isArray(payload.insights)) {
    return payload.insights.flatMap((item) => normalizeInsight(item))
  }

  if (typeof payload.answer === 'string') {
    return [
      {
        id: crypto.randomUUID(),
        kind: normalizeKind(payload.kind),
        title: typeof payload.title === 'string' ? payload.title : 'Ответ',
        body: payload.answer,
        confidence: normalizeConfidence(payload.confidence)
      }
    ]
  }

  return []
}

function normalizeInsight(value: unknown): InsightCard[] {
  if (!value || typeof value !== 'object') {
    return []
  }

  const candidate = value as Partial<Record<keyof InsightCard, unknown>>
  const body = typeof candidate.body === 'string' ? candidate.body.trim() : ''

  if (!body) {
    return []
  }

  return [
    {
      id: typeof candidate.id === 'string' ? candidate.id : crypto.randomUUID(),
      kind: normalizeKind(candidate.kind),
      title: typeof candidate.title === 'string' && candidate.title.trim() ? candidate.title.trim() : 'Ответ',
      body,
      confidence: normalizeConfidence(candidate.confidence)
    }
  ]
}

function normalizeKind(value: unknown): InsightCard['kind'] {
  return value === 'follow-up' || value === 'rubric' || value === 'risk' || value === 'summary'
    ? value
    : 'summary'
}

function normalizeConfidence(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 0.86
  }

  return Math.min(1, Math.max(0, value))
}

function getApiTimeoutMs(): number {
  const value = Number(import.meta.env.VITE_ASSISTANT_API_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS)
  return Number.isFinite(value) && value >= 5000 ? value : DEFAULT_TIMEOUT_MS
}
