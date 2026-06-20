# hand-canvas

Spatial card canvas controlled by webcam hand gestures — a visual experiment / home tech start-page demo.

## Stack
- Vite + React 19 + Tailwind v4 (`@tailwindcss/vite` plugin, no config file)
- MediaPipe Tasks Vision (`@mediapipe/tasks-vision`) — hand landmark detection in-browser
- No TypeScript, no router, no state library — single-component app
- Deployed on Vercel (auto-deploy from `main`), source at `github.com/zacwolff/hand-canvas`

## Commands
```bash
npm run dev      # dev server (localhost:5173)
npm run build    # production build → dist/
npm run preview  # preview dist/ locally
npm run lint     # eslint
```

## Architecture
- **Single page, no routing.** Everything lives in `src/App.jsx` — state, gesture loop, layout functions, camera init.
- **Cards are absolutely positioned** on a full-viewport canvas div. Layout functions compute `x/y` per card and animate via CSS transitions.
- **Hand tracking runs in a `requestAnimationFrame` loop** (separate from React render). Smoothed cursor position and gesture state are written to refs, then flushed to React state only when needed.
- **No physics.** Cards are repositioned by gesture/button triggers only — no continuous rAF loop outside of hand detection.

## Key files
- `src/App.jsx` — all state, gesture detection loop, layout functions (`spreadCards`, `stackCards`, `groupCards`, `makeCards`, `groupAnchors`), camera init, JSX
- `src/components/Card.jsx` — card renderer; 8 card types dispatched by `card.type`; tile cards get solid color via inline style
- `src/index.css` — all styles (Tailwind imported but no utility classes used; everything is hand-written CSS)
- `vite.config.js` — Vite + React + Tailwind plugin only

## Card system
Cards are defined in `CARD_DATA` (App.jsx). Two visual categories:

**Content cards** (white bg, dark text): `weather`, `calendar`, `tasks`, `feed`

**Tile cards** (solid color bg, white text): `now-playing`, `stat`, `home`, `media`
- Tile color comes from `card.tileColor` (now-playing, home, media) or `card.accent` (stat)
- Cards also have a `group: 1|2|3` field used by `groupCards` and `stackCards` to sort into 3 clusters

## Layout constants
```js
CARD_W = 220          // card width (px)
CARD_H = 180          // used for grid math (cards are auto-height)
SEARCH_H = 148        // approximate rendered height of search box
// Search box is CSS-centered: top:50%, left:50%, transform:translate(-50%,-50%)
// All layout anchors compute searchY = (window.innerHeight - SEARCH_H) / 2
```

## Gestures
| Gesture | Trigger | Action |
|---|---|---|
| Open palm | all 4 fingers extended | `spreadCards()` — distribute around search |
| Fist | all 4 tips below MCP | `stackCards()` — 3 group piles around search |
| Peace ✌️ | index+middle up, ring+pinky curled | `groupCards()` — 3 fanned groups around search |

Gesture requires ~500ms hold (`GESTURE_HOLD_MS`). Ring progress indicator shown on cursor.
EMA smoothing + deadzone on cursor; both adjustable via sliders (bottom-left when cam active).

## Spread layout (around centered search)
- 2 cards left column, 2 cards right column (flanking search, vertically centered)
- 2 cards above search (centered row)
- 5 cards below search (single responsive row)

## Stack/group anchors (`groupAnchors()`)
- Group 1 (media): left of search
- Group 2 (productivity): right of search
- Group 3 (home/stats): below search

## MediaPipe init
Loads WASM from `cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm`. Tries GPU delegate first, falls back to CPU. Step-by-step progress tracker shown during init. Camera permission required on first use — page refresh needed if permission granted mid-session.

## Live
- **Prod:** hand-canvas-lemon.vercel.app
- **Repo:** github.com/zacwolff/hand-canvas

## Gotchas
- Tailwind v4 uses `@import "tailwindcss"` in CSS — no `tailwind.config.js` needed. No utility classes are used; Tailwind is just imported for reset/base.
- `App.css` exists but is unused (Vite scaffold artifact).
- Card height is intrinsic (auto), but `CARD_H = 180` is used as an approximation for grid centering math — close enough.
- `SEARCH_H = 148` is a hardcoded estimate of the rendered search box height. If search box CSS changes height significantly, update this constant.
- MediaPipe model fetches ~5MB from Google CDN on first load.
- Webcam feed shown bottom-right, `scaleX(-1)` mirrored; overlay canvas drawn on same element.

## Current state
Fully working end-to-end. Light theme: warm gray canvas, white content cards, solid color tiles. Search box centered on screen. Hand gesture control + manual buttons both functional. Deployed on Vercel.

## Next ideas
- Make search box actually do something (filter cards, open apps)
- Add/remove cards dynamically
- Persist card positions to localStorage
- Smoother cursor interpolation (lerp instead of EMA)
- Responsive layout for smaller viewports
- More gesture types
