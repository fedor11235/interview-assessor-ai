# Interview Assessor AI

Consent-first desktop assistant for people who conduct interviews or exams. It captures approved audio/screen signals, turns them into a live transcript/OCR feed, and shows structured interviewer guidance in a compact overlay.

## What is included

- Electron + React + TypeScript desktop app.
- Main assessment console with interview modes: oral, text screen, coding.
- Transparent always-on-top overlay window.
- Output mode: overlay, audio, or both.
- Answer format switch: multiple-choice test or open/manual question.
- Custom macOS/Windows app icon.
- Explicit window/screen source picker for text and coding modes.
- Consent gate before capture starts.
- Browser-based screen and microphone capture for the MVP.
- Local dev assistant API that can call OpenAI and return production-like answers.
- Pluggable recognition layer for real STT/OCR adapters.
- JSON session export with transcript and AI answers.

## Quick start

```bash
npm install
npm run dev
```

Run the local AI API in a second terminal:

```bash
cp .env.example .env.local
# add OPENAI_API_KEY to .env.local
npm run api:dev
```

The Electron renderer sends signals to `VITE_ASSISTANT_API_URL`, which defaults to `http://localhost:3011/api/answer`. The local API keeps `OPENAI_API_KEY` server-side and returns the same answer shape a production backend can return.

If `OPENAI_API_KEY` is empty, the local API still works locally. On macOS it uses the built-in Vision OCR (`ENABLE_LOCAL_OCR=true`) to read text from the selected-window frame, then returns local rule-based guidance with `200 OK`. Set `OPENAI_API_KEY` later when you want model reasoning instead of local OCR/rules.

Build the app:

```bash
npm run build
```

Package for macOS and Windows:

```bash
npm run dist
```

## Real-time recognition strategy

Oral mode:

```text
microphone -> VAD/chunker -> streaming STT -> normalized transcript -> AI guidance
```

Text mode:

```text
selected window frames -> frame diff -> local API -> vision/text model -> AI answer
```

Local development without an API key:

```text
selected window frames -> local API -> macOS Vision OCR -> local rules -> overlay/audio answer
```

Production adapters:

- macOS screen capture: ScreenCaptureKit.
- Windows screen capture: Windows.Graphics.Capture.
- macOS OCR: Apple Vision.
- Windows OCR: Windows OCR / Windows AI text recognition.
- Cloud STT: OpenAI Realtime transcription.
- Offline STT: whisper.cpp or faster-whisper.

See [docs/realtime-recognition.md](docs/realtime-recognition.md) for the full plan.

## Ethics

This project is not intended for hidden assistance during interviews, undisclosed recording, or bypassing proctoring systems. It is an interviewer-side assessment tool that should be used only with participant consent.

See [docs/ethics-and-consent.md](docs/ethics-and-consent.md).

## Icon

Regenerate app icons after editing `assets/app-icon.svg`:

```bash
npm run icons
```

The icon source uses an MIT-licensed symbol from Microsoft Fluent UI System Icons. See [docs/third-party-notices.md](docs/third-party-notices.md).

## License

MIT
