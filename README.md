# AudioAI UI — Developer Documentation

A React + TypeScript + Vite application implementing the AudioAI for internal business puerpose only.

---

## Project Structure
```bash
AudioAiUI
├── public
|   ├── vite.svg
├── src
|   ├── components
        ├── atoms
            └── Button.tsx
            └── ErrorMessage.tsx
            └── Icon.tsx
            └── LoadingSpinner.tsx
            └── Logo.tsx
        ├── molecules
            └── FeatureCard.tsx
            └── Navigation.tsx
        ├── organisms
            └── DemoSection.tsx
            └── DownloadSection.tsx
            └── ErrorBoundary.tsx
            └── FeatureGrid.tsx
            └── FileProcessingSection.tsx
            └── Header.tsx
            └── Hero.tsx
            └── LiveTranscribeSection.tsx
│   ├── config
        └── env.ts
│   ├── context
        └── transcription.ts
        └── TranscriptionProvider.tsx
        └── useTranscription.ts
│   ├── services
        ├── api
            └── client.ts
            └── transcription.ts
        ├── ws
            └── livetranscribe.ts
│   ├── types
        └── api.ts
        └── index.ts
│   └── App.tsx
|   └── index.css
|   └── main.tsx
|   └── vite.env.d.ts
├── .editorcongig
├── .gitignore
├── .prettierrc
├── eslint.config.js
├── index.html
├── package-lock.json
├── package.json
├── postcss.config.js
├── README.md
├── tsconfig.app.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
```

## API Documentation (if applicable)

Current state: Frontend-integrated API layer with three endpoints. Backend responses are handled through UI state management.

Environment:
- `VITE_API_BASE_URL` (e.g., `http://localhost:0000`)
- `VITE_WS_BASE_URL` (e.g., `ws://localhost:0000`)

---

## Development Environment Setup

Prerequisites:
- Node.js >= 18, npm >= 9

Install:
- npm install

Install Vite and its plugin:
- npm install vite @vitejs/plugin-react --save-dev

Run locally:
- npm run dev (serves on http://localhost:5173)

---

Recommended stack:
- Vitest + React Testing Library + jsdom

Coverage:
- Enable via Vitest config flag --coverage and publish in CI for metrics.
