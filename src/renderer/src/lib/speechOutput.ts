import type { InsightCard } from './session'

export function speakInsight(insight: InsightCard, locale = 'ru-RU'): boolean {
  if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
    return false
  }

  const utterance = new SpeechSynthesisUtterance(`${insight.title}. ${insight.body}`)
  utterance.lang = locale
  utterance.rate = 0.98
  utterance.pitch = 0.96
  utterance.volume = 0.9

  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(utterance)
  return true
}

export function stopSpeechOutput(): void {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel()
  }
}
