export type InterviewMode = 'oral' | 'screen-text' | 'coding'

export type SignalSource = 'microphone' | 'screen' | 'manual'

export interface TranscriptItem {
  id: string
  source: SignalSource
  speaker: 'candidate' | 'interviewer' | 'screen'
  text: string
  time: string
  confidence: number
}

export interface InsightCard {
  id: string
  kind: 'follow-up' | 'rubric' | 'risk' | 'summary'
  title: string
  body: string
  confidence: number
}

export interface RubricItem {
  id: string
  label: string
  score: number
  max: number
}

export interface CaptureState {
  running: boolean
  screen: boolean
  microphone: boolean
  speechRecognition: boolean
  error?: string
}

export const modeLabels: Record<InterviewMode, string> = {
  oral: 'Устный',
  'screen-text': 'Текстовый',
  coding: 'Кодинг'
}

export const demoQuestions: Record<InterviewMode, string[]> = {
  oral: [
    'Кандидат описывает прошлый опыт с очередями сообщений и вспоминает инцидент с потерей событий.',
    'Звучит вопрос про компромиссы между latency, throughput и надежностью доставки.',
    'Кандидат утверждает, что идемпотентность решалась через уникальный ключ операции.'
  ],
  'screen-text': [
    'На экране задача: спроектировать сервис уведомлений с ретраями, дедупликацией и лимитами.',
    'В условии появились SLA: p95 до 250 мс, 10k событий в минуту, хранение истории 30 дней.',
    'Кандидат открыл схему таблиц и добавил индекс по user_id + created_at.'
  ],
  coding: [
    'Кандидат написал функцию debounce и обсуждает, когда очищать таймер.',
    'В тесте падает edge case с первым вызовом и trailing execution.',
    'Кандидат предлагает разделить чистую логику и слой DOM-событий.'
  ]
}

const starterInsights: InsightCard[] = [
  {
    id: 'starter-summary',
    kind: 'summary',
    title: 'Фокус сессии',
    body: 'Собираем наблюдения по фактам: контекст задачи, ход рассуждения, проверяемые trade-off и follow-up вопросы.',
    confidence: 0.92
  },
  {
    id: 'starter-rubric',
    kind: 'rubric',
    title: 'Рубрика',
    body: 'Отделяй уверенные ответы от предположений. Отмечай, где кандидат сам называет риски и способы проверки.',
    confidence: 0.88
  }
]

export const initialTranscript: TranscriptItem[] = [
  {
    id: 'initial-1',
    source: 'manual',
    speaker: 'interviewer',
    text: 'Сессия готова. Запусти захват после подтверждения согласия участников.',
    time: currentTime(),
    confidence: 1
  }
]

export const initialRubric: RubricItem[] = [
  { id: 'problem-framing', label: 'Понимание задачи', score: 0, max: 4 },
  { id: 'tradeoffs', label: 'Trade-off мышление', score: 0, max: 4 },
  { id: 'communication', label: 'Коммуникация', score: 0, max: 4 },
  { id: 'verification', label: 'Проверка решений', score: 0, max: 4 }
]

export function currentTime(): string {
  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(new Date())
}

export function createTranscriptItem(
  mode: InterviewMode,
  text: string,
  source: SignalSource = mode === 'oral' ? 'microphone' : 'screen'
): TranscriptItem {
  return {
    id: crypto.randomUUID(),
    source,
    speaker: source === 'screen' ? 'screen' : 'candidate',
    text,
    time: currentTime(),
    confidence: source === 'manual' ? 1 : 0.84 + Math.random() * 0.12
  }
}

export function createInsightFromSignal(item: TranscriptItem, mode: InterviewMode): InsightCard {
  const lower = item.text.toLowerCase()

  if (lower.includes('sla') || lower.includes('latency') || lower.includes('p95')) {
    return {
      id: crypto.randomUUID(),
      kind: 'follow-up',
      title: 'Проверь измеримость',
      body: 'Попроси кандидата назвать метрику, источник данных и поведение системы при нарушении SLA.',
      confidence: 0.86
    }
  }

  if (lower.includes('индекс') || lower.includes('таблиц')) {
    return {
      id: crypto.randomUUID(),
      kind: 'rubric',
      title: 'Хранилище',
      body: 'Отметь, связывает ли кандидат индекс с реальным query pattern и объемом данных.',
      confidence: 0.82
    }
  }

  if (lower.includes('edge case') || lower.includes('тест')) {
    return {
      id: crypto.randomUUID(),
      kind: 'risk',
      title: 'Edge cases',
      body: 'Хороший follow-up: какие входы ломают решение и какой минимальный тест это доказывает?',
      confidence: 0.9
    }
  }

  return {
    id: crypto.randomUUID(),
    kind: mode === 'oral' ? 'follow-up' : 'summary',
    title: mode === 'oral' ? 'Уточняющий вопрос' : 'Смысл фрагмента',
    body:
      mode === 'oral'
        ? 'Попроси привести конкретный пример из продакшена: роль кандидата, ограничение и итоговое решение.'
        : 'Сохрани этот фрагмент как наблюдение и проверь, не меняется ли условие задачи дальше.',
    confidence: 0.78
  }
}

export function getStarterInsights(): InsightCard[] {
  return starterInsights
}

