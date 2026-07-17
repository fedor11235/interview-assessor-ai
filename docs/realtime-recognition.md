# Real-time Recognition Plan

## Oral interviews

Recommended MVP:

1. Capture microphone audio with `getUserMedia`.
2. Split audio into short chunks with voice activity detection.
3. Send chunks to a streaming STT adapter.
4. Append only final transcript segments to the assessment context.
5. Ask the model for structured interviewer guidance.

Production choices:

- Cloud STT: OpenAI Realtime transcription for low latency.
- Local STT: `whisper.cpp` or `faster-whisper` for privacy-sensitive sessions.
- Language handling: start with `ru-RU` and `en-US`, then add auto-detect.

## Text and screen-based exams

Recommended MVP:

1. Capture a selected window or monitor.
2. Downscale frames for cheap diffing.
3. Run OCR only when frame delta exceeds a threshold.
4. Deduplicate lines with a rolling text hash.
5. Send changed text, not raw screenshots, to the assessment engine.

Production choices:

- macOS OCR: Apple Vision `VNRecognizeTextRequest`.
- Windows OCR: Windows OCR / Windows AI text recognition APIs.
- Cross-platform fallback: PaddleOCR or Tesseract for offline mode.

## Latency budget

- Audio chunk: 250-800 ms.
- STT partial result: 300-1200 ms depending on provider.
- OCR frame sampling: 1-2 FPS for text tasks, 4-8 FPS for coding tasks.
- AI guidance: 500-2000 ms with a small rolling context.

## Context strategy

Keep three buffers:

- `short_context`: last 30-90 seconds for immediate follow-up.
- `session_facts`: durable facts and rubric notes.
- `open_questions`: unresolved points the interviewer may ask next.

The model should receive compact structured context, not the full raw stream every time.

