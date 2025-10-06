# AudioAI UI — Developer Documentation

A React + TypeScript + Vite application implementing the AudioAI for internal business puerpose only.

---

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
