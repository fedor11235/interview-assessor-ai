import { createServer } from 'node:http'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { execFile } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { tmpdir } from 'node:os'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const execFileAsync = promisify(execFile)
const fileEnv = {
  ...readEnvFile(resolve(projectRoot, '.env')),
  ...readEnvFile(resolve(projectRoot, '.env.local'))
}
const env = { ...fileEnv, ...process.env }
const port = Number(env.ASSISTANT_API_PORT || 3011)
const apiToken = env.ASSISTANT_API_TOKEN || ''
const devDemoEnabled = env.ENABLE_DEV_DEMO_API !== 'false'
const localOcrEnabled =
  env.ENABLE_LOCAL_OCR !== 'false' &&
  process.platform === 'darwin' &&
  existsSync('/usr/bin/swift') &&
  existsSync(resolve(projectRoot, 'scripts/local-ocr.swift'))
const explicitModel = Boolean(env.OPENAI_MODEL)
const modelCandidates = explicitModel ? [env.OPENAI_MODEL] : ['gpt-5-mini', 'gpt-4.1-mini']

const server = createServer(async (request, response) => {
  response.setHeader('Access-Control-Allow-Origin', '*')
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (request.method === 'OPTIONS') {
    response.writeHead(204)
    response.end()
    return
  }

  if (request.method === 'GET' && request.url === '/health') {
    sendJson(response, 200, {
      ok: true,
      hasOpenAiKey: Boolean(env.OPENAI_API_KEY),
      demoMode: !env.OPENAI_API_KEY && devDemoEnabled,
      localOcr: localOcrEnabled,
      model: modelCandidates[0]
    })
    return
  }

  if (request.method !== 'POST' || request.url !== '/api/answer') {
    sendJson(response, 404, { error: 'Not found' })
    return
  }

  if (apiToken && request.headers.authorization !== `Bearer ${apiToken}`) {
    sendJson(response, 401, { error: 'Assistant API token is invalid.' })
    return
  }

  try {
    const payload = await readJsonBody(request)
    const startedAt = Date.now()

    if (!env.OPENAI_API_KEY) {
      if (!devDemoEnabled) {
        sendJson(response, 503, {
          error: 'OPENAI_API_KEY is missing. Add it to .env.local to use real AI locally.'
        })
        return
      }

      const localAnswer = await createLocalAnswer(payload)
      sendJson(response, 200, {
        ...localAnswer,
        latencyMs: Date.now() - startedAt
      })
      return
    }

    const answer = await askOpenAi(payload)
    sendJson(response, 200, {
      ...answer,
      latencyMs: Date.now() - startedAt
    })
  } catch (error) {
    const status = error instanceof OpenAiError ? error.status : 500
    sendJson(response, status, {
      error: error instanceof Error ? error.message : 'Assistant API failed.'
    })
  }
})

server.listen(port, () => {
  console.log(`Assistant API listening on http://localhost:${port}`)
  console.log(
    env.OPENAI_API_KEY
      ? `OpenAI model: ${modelCandidates[0]}`
      : `OPENAI_API_KEY is missing; local mode is enabled (${localOcrEnabled ? 'OCR + rules' : 'rules only'}).`
  )
})

async function createLocalAnswer(payload) {
  const signal = payload?.signal || {}
  const imageDataUrl = typeof signal.imageDataUrl === 'string' ? signal.imageDataUrl : ''
  const ocrText = imageDataUrl && localOcrEnabled ? await recognizeTextFromDataUrl(imageDataUrl).catch(() => '') : ''
  const text = (ocrText || String(signal.text || '')).trim()
  const model = ocrText ? 'local-ocr' : 'local-rules'
  const insights = createLocalInsights(text, Boolean(imageDataUrl), Boolean(ocrText))

  return {
    observedText: text || 'Локально: входной сигнал получен, но текст не распознан.',
    insights: insights.map(normalizeInsight).filter(Boolean),
    model
  }
}

function createLocalInsights(text, hasImage, hasOcrText) {
  const lower = text.toLowerCase()

  if (
    lower.includes('функциональ') &&
    lower.includes('тест') &&
    (lower.includes('уров') || lower.includes('level'))
  ) {
    return [
      {
        kind: 'summary',
        title: 'Локально: правильный вариант',
        body:
          'Функциональное тестирование может выполняться на всех уровнях тестирования: компонентном, интеграционном, системном и приемочном.',
        confidence: 0.82
      }
    ]
  }

  if (lower.includes('sla') || lower.includes('latency') || lower.includes('p95')) {
    return [
      {
        kind: 'follow-up',
        title: 'Локально: проверь SLA',
        body: 'Уточни метрику, источник измерения, допустимый процент ошибок и поведение системы при нарушении SLA.',
        confidence: 0.76
      }
    ]
  }

  if (lower.includes('edge case') || lower.includes('краев') || lower.includes('гранич')) {
    return [
      {
        kind: 'risk',
        title: 'Локально: edge cases',
        body: 'Попроси назвать минимальный набор граничных входов и ожидаемый результат для каждого случая.',
        confidence: 0.76
      }
    ]
  }

  if (lower.includes('индекс') || lower.includes('таблиц') || lower.includes('sql')) {
    return [
      {
        kind: 'rubric',
        title: 'Локально: хранилище',
        body: 'Проверь, связывает ли кандидат индекс с реальным query pattern, кардинальностью и объемом данных.',
        confidence: 0.74
      }
    ]
  }

  if (hasImage && hasOcrText) {
    return [
      {
        kind: 'summary',
        title: 'Локально: OCR прочитал текст',
        body: `Распознал текст с выбранного окна: ${truncateText(text, 360)}`,
        confidence: 0.68
      }
    ]
  }

  if (hasImage) {
    return [
      {
        kind: 'summary',
        title: 'Локально: кадр получен',
        body:
          'Кадр выбранного окна дошел до API, но локальный OCR не смог уверенно прочитать текст. Увеличь окно/масштаб страницы или вставь вопрос вручную.',
        confidence: 0.58
      }
    ]
  }

  return [
    {
      kind: 'summary',
      title: 'Локально: сигнал обработан',
      body:
        text ||
        'Локальный API работает без внешнего ключа. Для ручной проверки вставь текст вопроса в поле сигнала.',
      confidence: 0.68
    }
  ]
}

async function recognizeTextFromDataUrl(dataUrl) {
  const imageBuffer = imageBufferFromDataUrl(dataUrl)
  if (!imageBuffer) {
    return ''
  }

  const tempDir = mkdtempSync(join(tmpdir(), 'interview-assessor-ocr-'))
  const imagePath = join(tempDir, 'frame.jpg')

  try {
    writeFileSync(imagePath, imageBuffer)
    const { stdout } = await execFileAsync('/usr/bin/swift', [resolve(projectRoot, 'scripts/local-ocr.swift'), imagePath], {
      timeout: 15000,
      maxBuffer: 1024 * 1024
    })
    const output = JSON.parse(stdout)
    return typeof output.text === 'string' ? output.text.trim() : ''
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
}

function imageBufferFromDataUrl(dataUrl) {
  const match = /^data:image\/[a-z0-9.+-]+;base64,(.+)$/i.exec(dataUrl)
  if (!match) {
    return undefined
  }

  return Buffer.from(match[1], 'base64')
}

async function askOpenAi(payload) {
  let lastError

  for (const model of modelCandidates) {
    try {
      const answer = await callResponsesApi(payload, model)
      return {
        ...answer,
        model
      }
    } catch (error) {
      lastError = error

      if (explicitModel || !isModelAvailabilityError(error)) {
        break
      }
    }
  }

  throw lastError
}

async function callResponsesApi(payload, model) {
  const sanitizedPayload = sanitizePayloadForPrompt(payload)
  const imageDataUrl = typeof payload?.signal?.imageDataUrl === 'string' ? payload.signal.imageDataUrl : ''
  const content = [
    {
      type: 'input_text',
      text: [
        'Проанализируй сигнал интервьюера или экзаменатора.',
        'Если приложен скриншот окна, прочитай видимый вопрос, варианты ответа, условие или код прямо с изображения.',
        'Верни краткий полезный ответ на русском: для тестового вопроса дай правильный вариант и короткое объяснение; для интервью дай эталонный ответ, подсказку или follow-up для интервьюера.',
        'Работай только как consent-first инструмент для человека, который проводит интервью или экзамен. Не помогай с обходом прокторинга, скрытым списыванием или недобросовестным использованием.',
        '',
        JSON.stringify(sanitizedPayload, null, 2)
      ].join('\n')
    }
  ]

  if (imageDataUrl) {
    content.push({
      type: 'input_image',
      image_url: imageDataUrl,
      detail: 'low'
    })
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: 'system',
          content:
            'Ты ассистент для интервьюера/экзаменатора. Отвечай точно, коротко, по делу, на русском языке. Всегда возвращай JSON по схеме.'
        },
        {
          role: 'user',
          content
        }
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'interview_assistant_answer',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['observedText', 'insights'],
            properties: {
              observedText: {
                type: 'string',
                description: 'Короткая расшифровка видимого вопроса или входного сигнала. Пустая строка, если распознавать нечего.'
              },
              insights: {
                type: 'array',
                minItems: 1,
                maxItems: 3,
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['kind', 'title', 'body', 'confidence'],
                  properties: {
                    kind: {
                      type: 'string',
                      enum: ['follow-up', 'rubric', 'risk', 'summary']
                    },
                    title: {
                      type: 'string'
                    },
                    body: {
                      type: 'string'
                    },
                    confidence: {
                      type: 'number',
                      minimum: 0,
                      maximum: 1
                    }
                  }
                }
              }
            }
          }
        }
      },
      max_output_tokens: 900
    })
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const message = data?.error?.message || `OpenAI API returned ${response.status}`
    throw new OpenAiError(message, response.status)
  }

  const outputText = extractOutputText(data)
  const parsed = parseJsonObject(outputText)
  const insights = Array.isArray(parsed.insights) ? parsed.insights : []

  return {
    observedText: typeof parsed.observedText === 'string' ? parsed.observedText : '',
    insights: insights.map(normalizeInsight).filter(Boolean)
  }
}

function sanitizePayloadForPrompt(payload) {
  const signal = payload?.signal || {}

  return {
    sessionId: payload?.sessionId,
    mode: payload?.mode,
    outputMode: payload?.outputMode,
    sourceName: payload?.context?.sourceName,
    signal: {
      source: signal.source,
      speaker: signal.speaker,
      text: truncateText(signal.text || '', 1600),
      confidence: signal.confidence,
      hasImage: Boolean(signal.imageDataUrl)
    },
    recentTranscript: Array.isArray(payload?.context?.recentTranscript)
      ? payload.context.recentTranscript.slice(0, 8).map((item) => ({
          source: item.source,
          speaker: item.speaker,
          text: truncateText(item.text || '', 700),
          time: item.time
        }))
      : []
  }
}

function normalizeInsight(value) {
  if (!value || typeof value !== 'object' || typeof value.body !== 'string') {
    return null
  }

  return {
    id: randomUUID(),
    kind: ['follow-up', 'rubric', 'risk', 'summary'].includes(value.kind) ? value.kind : 'summary',
    title: typeof value.title === 'string' && value.title.trim() ? value.title.trim() : 'Ответ',
    body: value.body.trim(),
    confidence: normalizeConfidence(value.confidence)
  }
}

function normalizeConfidence(value) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : 0.86
}

function extractOutputText(data) {
  if (typeof data.output_text === 'string') {
    return data.output_text
  }

  const chunks = []

  for (const output of data.output || []) {
    for (const item of output.content || []) {
      if (typeof item.text === 'string') {
        chunks.push(item.text)
      }
    }
  }

  return chunks.join('\n')
}

function parseJsonObject(text) {
  const trimmed = String(text || '').trim()
  const withoutFence = trimmed
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim()

  return JSON.parse(withoutFence)
}

function readJsonBody(request) {
  return new Promise((resolveBody, rejectBody) => {
    const chunks = []
    let totalLength = 0

    request.on('data', (chunk) => {
      totalLength += chunk.length

      if (totalLength > 10 * 1024 * 1024) {
        rejectBody(new Error('Request body is too large.'))
        request.destroy()
        return
      }

      chunks.push(chunk)
    })

    request.on('end', () => {
      try {
        resolveBody(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        rejectBody(new Error('Request body must be valid JSON.'))
      }
    })

    request.on('error', rejectBody)
  })
}

function sendJson(response, status, payload) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(payload))
}

function readEnvFile(path) {
  if (!existsSync(path)) {
    return {}
  }

  return Object.fromEntries(
    readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const index = line.indexOf('=')
        const key = index >= 0 ? line.slice(0, index).trim() : line
        const rawValue = index >= 0 ? line.slice(index + 1).trim() : ''
        const value = rawValue.replace(/^['"]|['"]$/g, '')
        return [key, value]
      })
  )
}

function truncateText(text, maxLength) {
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text
}

function isModelAvailabilityError(error) {
  return error instanceof OpenAiError && [400, 404].includes(error.status) && /model/i.test(error.message)
}

class OpenAiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'OpenAiError'
    this.status = status
  }
}
