# hand-canvas

Spatial card canvas with webcam hand-gesture control. A visual experiment inspired by Lukas Kmoth's portfolio.

## Stack
- Vite + React + Tailwind (`@tailwindcss/vite`)
- MediaPipe Tasks Vision — hand landmark detection in the browser
- Deployed on Vercel, source on GitHub (`zacwolff/hand-canvas`)

## Live
- **Prod:** hand-canvas-lemon.vercel.app
- **Repo:** github.com/zacwolff/hand-canvas

## How it works
- Four draggable cards on a dot-grid canvas — always mouse-draggable
- "Enable Hand Tracking" button loads MediaPipe WASM + hand model (~5MB from Google CDN), then opens webcam
- Index finger tip position maps to a cursor (X-axis flipped for mirror)
- Pinch (index + thumb < 0.065 normalized distance) = grab and drag card
- GPU delegate with CPU fallback; step-by-step progress tracker during init
- Webcam preview shown bottom-right, mirrored; green status dot when active

## Key files
- `src/App.jsx` — canvas, hand tracking loop, mouse drag, all state
- `src/components/Card.jsx` — card UI
- `src/index.css` — all styles (no Tailwind utilities used directly, just imported)

## Current state
Working end-to-end. Mouse drag + hand gesture drag both functional.

## Next ideas
- Add/remove cards dynamically
- Persist card positions (localStorage)
- Custom card content
- Smoother hand cursor interpolation (lerp)
- Confine cards to viewport bounds
