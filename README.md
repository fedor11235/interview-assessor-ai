# Interview Assessor AI

Consent-first desktop assistant for people who conduct interviews or exams. It captures approved audio/screen signals, turns them into a live transcript/OCR feed, and shows structured interviewer guidance in a compact overlay.

## What is included

- Electron + React + TypeScript desktop app.
- Main assessment console with interview modes: oral, text screen, coding.
- Transparent always-on-top overlay window.
- Custom macOS/Windows app icon.
- Consent gate before capture starts.
- Browser-based screen and microphone capture for the MVP.
- Pluggable recognition layer for real STT/OCR adapters.
- JSON session export with transcript, insights, and rubric scores.

## Quick start

```bash
npm install
npm run dev
```

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
screen frames -> frame diff -> OCR changed regions -> dedupe -> AI guidance
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
