import { useEffect, useRef, useState, useCallback } from 'react'
import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'
import Card from './components/Card'
import './index.css'

const CARD_DATA = [
  {
    id: 1, type: 'now-playing', group: 1,
    title: 'Midnight Rain', artist: 'Taylor Swift · Midnights',
    progress: 0.38, time: '1:24', duration: '3:44',
    gradient: 'linear-gradient(145deg, #1a0533 0%, #5b21b6 52%, #db2777 100%)',
  },
  {
    id: 2, type: 'weather', group: 3,
    city: 'New York', temp: '72', unit: '°',
    condition: 'Partly Cloudy', hi: '78', lo: '64',
  },
  {
    id: 3, type: 'calendar', group: 2,
    events: [
      { time: '10:00', title: '1:1 Design Sync', color: '#818cf8' },
      { time: '14:00', title: 'Prototype Review', color: '#fbbf24' },
      { time: '17:30', title: 'Team Standup',     color: '#34d399' },
    ],
  },
  {
    id: 4, type: 'tasks', group: 2,
    items: [
      'Ship token update PR',
      'Review Figma components',
      'Draft client proposal',
    ],
  },
  {
    id: 5, type: 'home', group: 3,
    room: 'Living Room', temp: '71',
    lightsOn: 3, lightsTotal: 6,
  },
  {
    id: 6, type: 'stat', group: 2,
    label: 'Steps', value: '8,432', sub: 'Goal: 10k', accent: '#34d399',
  },
  {
    id: 7, type: 'stat', group: 3,
    label: 'Unread', value: '23', sub: 'messages', accent: '#818cf8',
  },
  {
    id: 8, type: 'stat', group: 2,
    label: 'Focus', value: '2h 14m', sub: 'today', accent: '#fbbf24',
  },
  {
    id: 9, type: 'feed', group: 1,
    title: 'Morning Brief',
    items: [
      'Apple unveils new AI features at WWDC',
      'Design Systems Summit opens in SF',
      'React 20 canary build now available',
    ],
  },
  {
    id: 10, type: 'media', group: 1,
    show: 'Severance', episode: 'S2 · Episode 6',
    label: 'Continue Watching',
    gradient: 'linear-gradient(145deg, #0a1628 0%, #1e3a5f 55%, #0f2540 100%)',
  },
  {
    id: 11, type: 'stat', group: 3,
    label: 'Air Quality', value: 'Good', sub: 'AQI 42', accent: '#34d399',
  },
]

const CARD_W = 220
const CARD_H = 180
const GESTURE_HOLD_MS = 500
const SEARCH_H = 148  // approximate rendered height of search box

const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [0,9],[9,10],[10,11],[11,12],
  [0,13],[13,14],[14,15],[15,16],
  [0,17],[17,18],[19,19],[19,20],
  [5,9],[9,13],[13,17],
]

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5)
}

function groupAnchors() {
  const W = window.innerWidth
  const H = window.innerHeight
  const searchW = Math.min(600, W - 48)
  const sideW = (W - searchW) / 2
  const searchY = (H - SEARCH_H) / 2
  const leftX  = Math.max(16, sideW / 2 - CARD_W / 2)
  const rightX = Math.min(W - CARD_W - 16, W - sideW / 2 - CARD_W / 2)
  return [
    { x: leftX,              y: searchY + (SEARCH_H - CARD_H) / 2 },
    { x: rightX,             y: searchY + (SEARCH_H - CARD_H) / 2 },
    { x: W / 2 - CARD_W / 2, y: searchY + SEARCH_H + 24 },
  ]
}

function makeCards() {
  const anchors = groupAnchors()
  const rots = [[-7,-3,1,5,-5,-2,3], [-6,-2,2,6,-4,-1,4], [-8,-4,0,4,-6,-3,3,-1]]
  const result = []
  ;[1, 2, 3].forEach((g, gi) => {
    shuffle(CARD_DATA.filter(c => c.group === g)).forEach((c, i) => {
      result.push({ ...c, x: anchors[gi].x, y: anchors[gi].y, rotation: rots[gi][i % rots[gi].length] })
    })
  })
  return result
}

function isOpenPalm(lm) {
  return (
    lm[8].y  < lm[6].y  &&
    lm[12].y < lm[10].y &&
    lm[16].y < lm[14].y &&
    lm[20].y < lm[18].y
  )
}

function isFist(lm) {
  return (
    lm[8].y  > lm[5].y  &&
    lm[12].y > lm[9].y  &&
    lm[16].y > lm[13].y &&
    lm[20].y > lm[17].y
  )
}

function isPeaceSign(lm) {
  return (
    lm[8].y  < lm[6].y  && // index extended
    lm[12].y < lm[10].y && // middle extended
    lm[16].y > lm[13].y && // ring curled
    lm[20].y > lm[17].y    // pinky curled
  )
}

function drawHandOverlay(canvas, landmarks) {
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  if (!landmarks) return
  const W = canvas.width, H = canvas.height

  ctx.strokeStyle = 'rgba(255,255,255,0.55)'
  ctx.lineWidth = 1
  for (const [a, b] of HAND_CONNECTIONS) {
    ctx.beginPath()
    ctx.moveTo(landmarks[a].x * W, landmarks[a].y * H)
    ctx.lineTo(landmarks[b].x * W, landmarks[b].y * H)
    ctx.stroke()
  }

  for (const lm of landmarks) {
    ctx.beginPath()
    ctx.arc(lm.x * W, lm.y * H, 2.5, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.fill()
  }

  // Highlight index tip + thumb tip
  for (const idx of [4, 8]) {
    ctx.beginPath()
    ctx.arc(landmarks[idx].x * W, landmarks[idx].y * H, 4, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,200,100,0.95)'
    ctx.fill()
  }
}

export default function App() {
  const [cards, setCards] = useState(() => makeCards())
  const [handPos, setHandPos] = useState(null)
  const [gestureProgress, setGestureProgress] = useState(0)
  const [activeGesture, setActiveGesture] = useState(null)
  const [isAnimating, setIsAnimating] = useState(false)
  const [camActive, setCamActive] = useState(false)
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(0)
  const [error, setError] = useState(null)
  const [deadzone, setDeadzone] = useState(10)
  const [smooth, setSmooth] = useState(0.1)

  const cardsRef = useRef(cards)
  const gestureStartRef = useRef(null)
  const gestureCooldownRef = useRef(false)
  const currentGestureRef = useRef(null)
  const smoothPosRef = useRef(null)
  const videoRef = useRef(null)
  const overlayCanvasRef = useRef(null)
  const animFrameRef = useRef(null)
  const handLandmarkerRef = useRef(null)

  const spreadCards = useCallback(() => {
    const W = window.innerWidth
    const H = window.innerHeight
    const gap = 16
    const searchW = Math.min(600, W - 48)
    const sideW   = (W - searchW) / 2
    const searchY = (H - SEARCH_H) / 2
    const n = cardsRef.current.length
    const positions = []

    // Left + right columns, centered vertically on the search box
    const canFitSide = sideW >= CARD_W + 32
    const perSide   = canFitSide ? 2 : 0
    const leftX     = Math.max(16, sideW / 2 - CARD_W / 2)
    const rightX    = Math.min(W - CARD_W - 16, W - sideW / 2 - CARD_W / 2)
    const sideBlockH = perSide * CARD_H + Math.max(0, perSide - 1) * gap
    const sideStartY = searchY + (SEARCH_H - sideBlockH) / 2

    for (let i = 0; i < perSide; i++) positions.push({ x: leftX,  y: sideStartY + i * (CARD_H + gap) })
    for (let i = 0; i < perSide; i++) positions.push({ x: rightX, y: sideStartY + i * (CARD_H + gap) })

    // Above search: 2 cards centered
    const aboveCount = 2
    const aboveW = aboveCount * CARD_W + (aboveCount - 1) * gap
    for (let i = 0; i < aboveCount; i++) {
      positions.push({ x: (W - aboveW) / 2 + i * (CARD_W + gap), y: Math.max(8, searchY - CARD_H - gap) })
    }

    // Below search: remaining cards in a responsive centered row
    const belowCount = n - perSide * 2 - aboveCount
    const maxCols = Math.floor((W - 32) / (CARD_W + gap))
    const cols    = Math.min(belowCount, maxCols)
    const belowW  = cols * CARD_W + (cols - 1) * gap
    for (let i = 0; i < belowCount; i++) {
      positions.push({
        x: (W - belowW) / 2 + (i % cols) * (CARD_W + gap),
        y: searchY + SEARCH_H + gap + Math.floor(i / cols) * (CARD_H + gap),
      })
    }

    const updated = cardsRef.current.map((c, i) => ({
      ...c, x: positions[i].x, y: positions[i].y, rotation: 0,
    }))
    cardsRef.current = updated
    setIsAnimating(true)
    setCards([...updated])
    setTimeout(() => setIsAnimating(false), 650)
  }, [])

  const groupCards = useCallback(() => {
    const anchors = groupAnchors()
    const rots = [[-6,-3,0,2,-4], [-5,-1,3,7,-3], [-4,0,5,-6,-2]]
    const next = [...cardsRef.current]
    ;[1, 2, 3].forEach((g, gi) => {
      next.filter(c => c.group === g).forEach((c, i) => {
        const idx = next.findIndex(n => n.id === c.id)
        next[idx] = { ...c, x: anchors[gi].x + i * 12, y: anchors[gi].y + i * 8, rotation: rots[gi][i % rots[gi].length] }
      })
    })
    cardsRef.current = next
    setIsAnimating(true)
    setCards([...next])
    setTimeout(() => setIsAnimating(false), 650)
  }, [])

  const stackCards = useCallback(() => {
    const anchors = groupAnchors()
    const rots = [[-7,-3,1,5,-5,-2,3], [-6,-2,2,6,-4,-1,4], [-8,-4,0,4,-6,-3,3,-1]]
    const next = [...cardsRef.current]
    ;[1, 2, 3].forEach((g, gi) => {
      next.filter(c => c.group === g).forEach((c, i) => {
        const idx = next.findIndex(n => n.id === c.id)
        next[idx] = { ...c, x: anchors[gi].x, y: anchors[gi].y, rotation: rots[gi][i % rots[gi].length] }
      })
    })
    const updated = next
    cardsRef.current = updated
    setIsAnimating(true)
    setCards([...updated])
    setTimeout(() => setIsAnimating(false), 650)
  }, [])

  const startCamera = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      setStep(1)
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      )
      setStep(2)
      let landmarker
      try {
        landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task', delegate: 'GPU' },
          runningMode: 'VIDEO', numHands: 1,
        })
      } catch {
        landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task', delegate: 'CPU' },
          runningMode: 'VIDEO', numHands: 1,
        })
      }
      handLandmarkerRef.current = landmarker
      setStep(3)
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      videoRef.current.srcObject = stream
      await videoRef.current.play()
      setCamActive(true)
    } catch (err) {
      console.error('Hand tracking init failed:', err)
      setError('Could not start — check camera permissions and try again.')
    }
    setLoading(false); setStep(0)
  }, [])

  useEffect(() => {
    if (!camActive) return

    const detect = (timestamp) => {
      animFrameRef.current = requestAnimationFrame(detect)
      const video = videoRef.current
      const landmarker = handLandmarkerRef.current
      if (!video || !landmarker || video.readyState < 2 || video.paused) return

      const result = landmarker.detectForVideo(video, timestamp)
      const canvas = overlayCanvasRef.current

      if (!result.landmarks?.length) {
        setHandPos(null)
        setGestureProgress(0); setActiveGesture(null)
        gestureStartRef.current = null; currentGestureRef.current = null
        smoothPosRef.current = null
        if (canvas) drawHandOverlay(canvas, null)
        return
      }

      const lm = result.landmarks[0]
      if (canvas) drawHandOverlay(canvas, lm)

      const indexTip = lm[8]
      const rawX = (1 - indexTip.x) * window.innerWidth
      const rawY = indexTip.y * window.innerHeight

      if (!smoothPosRef.current) smoothPosRef.current = { x: rawX, y: rawY }
      const ddx = rawX - smoothPosRef.current.x
      const ddy = rawY - smoothPosRef.current.y
      if (Math.hypot(ddx, ddy) > deadzone) {
        smoothPosRef.current.x += ddx * smooth
        smoothPosRef.current.y += ddy * smooth
      }
      const x = smoothPosRef.current.x, y = smoothPosRef.current.y

      setHandPos({ x, y })

      const palm = isOpenPalm(lm)
      const fist = !palm && isFist(lm)
      const peace = !palm && !fist && isPeaceSign(lm)
      const gesture = palm ? 'spread' : fist ? 'stack' : peace ? 'group' : null

      if (gesture && gesture === currentGestureRef.current) {
        if (!gestureStartRef.current) gestureStartRef.current = timestamp
        const progress = Math.min((timestamp - gestureStartRef.current) / GESTURE_HOLD_MS, 1)
        setGestureProgress(progress)
        setActiveGesture(gesture)
        if (progress >= 1 && !gestureCooldownRef.current) {
          if (gesture === 'spread') spreadCards()
          else if (gesture === 'stack') stackCards()
          else if (gesture === 'group') groupCards()
          gestureCooldownRef.current = true
          gestureStartRef.current = null
          setGestureProgress(0); setActiveGesture(null)
          setTimeout(() => { gestureCooldownRef.current = false }, 1200)
        }
      } else {
        currentGestureRef.current = gesture
        gestureStartRef.current = gesture ? timestamp : null
        setGestureProgress(0)
        setActiveGesture(gesture)
      }
    }

    animFrameRef.current = requestAnimationFrame(detect)
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current) }
  }, [camActive, spreadCards, stackCards, groupCards, deadzone, smooth])


  const RING_R = 18
  const RING_C = 2 * Math.PI * RING_R
  const ringColor = activeGesture === 'spread' ? 'rgba(80,160,255,0.85)' : activeGesture === 'group' ? 'rgba(52,199,89,0.85)' : 'rgba(0,0,0,0.7)'

  return (
    <div className="canvas-root">
      {cards.map(card => (
        <Card
          key={card.id}
          card={card}
          isAnimating={isAnimating}
        />
      ))}

      {handPos && (
        <div
          className={`hand-cursor ${activeGesture ? 'gesture' : ''}`}
          style={{ left: handPos.x, top: handPos.y }}
        >
          {gestureProgress > 0 && (
            <svg className="palm-ring" width="44" height="44" viewBox="0 0 44 44">
              <circle cx="22" cy="22" r={RING_R} fill="none" stroke="rgba(0,0,0,0.1)" strokeWidth="2.5" />
              <circle
                cx="22" cy="22" r={RING_R}
                fill="none" stroke={ringColor} strokeWidth="2.5" strokeLinecap="round"
                strokeDasharray={RING_C}
                strokeDashoffset={RING_C * (1 - gestureProgress)}
                transform="rotate(-90 22 22)"
                style={{ transition: 'stroke-dashoffset 0.05s linear' }}
              />
            </svg>
          )}
        </div>
      )}

      <div className="video-container">
        <video ref={videoRef} className={camActive ? 'webcam-preview' : 'webcam-hidden'} muted playsInline />
        {camActive && (
          <canvas
            ref={overlayCanvasRef}
            className="webcam-overlay"
            width={148}
            height={84}
          />
        )}
      </div>

      <div className="search-wrap">
        <div className="search-box">
          <textarea
            className="search-input"
            placeholder="Search, ask, or command…"
            rows={2}
          />
          <div className="search-footer">
            <div className="search-chips">
              {['⛅ Weather', '🎵 Music', '🏠 Home', '📅 Today'].map(label => (
                <button key={label} className="search-chip">{label}</button>
              ))}
            </div>
            <div className="search-footer-right">
              {camActive && <div className="search-status-dot" />}
              <button className="search-submit">
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M1.5 6.5h10M7 2l4.5 4.5L7 11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {camActive && (
        <>
          <div className="settings-panel">
            <div className="settings-row">
              <label>Deadzone <span>{deadzone}px</span></label>
              <input type="range" min="0" max="30" value={deadzone} onChange={e => setDeadzone(+e.target.value)} />
            </div>
            <div className="settings-row">
              <label>Smoothing <span>{Math.round((1 - smooth) * 100)}%</span></label>
              <input type="range" min="0.05" max="0.6" step="0.01" value={smooth} onChange={e => setSmooth(+e.target.value)} />
            </div>
          </div>
        </>
      )}

      <div className="gesture-buttons">
        <button className="gesture-btn" onClick={stackCards}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="1" y="4" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
            <rect x="3" y="2" width="8" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
            <rect x="5" y="0" width="4" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
          </svg>
          Stack
        </button>
        <button className="gesture-btn" onClick={spreadCards}>
          <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
            <rect x="0.5" y="1.5" width="4" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
            <rect x="6" y="1.5" width="4" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
            <rect x="11.5" y="1.5" width="4" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
          </svg>
          Spread
        </button>
        <button className="gesture-btn" onClick={groupCards}>
          <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
            <rect x="0.5" y="3" width="3.5" height="6" rx="1" stroke="currentColor" strokeWidth="1.3"/>
            <rect x="1.5" y="1.5" width="3.5" height="6" rx="1" stroke="currentColor" strokeWidth="1.3"/>
            <rect x="6.25" y="3" width="3.5" height="6" rx="1" stroke="currentColor" strokeWidth="1.3"/>
            <rect x="7.25" y="1.5" width="3.5" height="6" rx="1" stroke="currentColor" strokeWidth="1.3"/>
            <rect x="12" y="3" width="3.5" height="6" rx="1" stroke="currentColor" strokeWidth="1.3"/>
            <rect x="13" y="1.5" width="3.5" height="6" rx="1" stroke="currentColor" strokeWidth="1.3"/>
          </svg>
          Group
        </button>
      </div>

      {!camActive && (
        <div className="launch-panel">
          {error && <div className="launch-error">{error}</div>}
          {loading ? (
            <div className="progress-tracker">
              {[
                { n: 1, label: 'WASM runtime' },
                { n: 2, label: 'Hand model' },
                { n: 3, label: 'Camera' },
              ].map(({ n, label }) => (
                <div key={n} className={`progress-step ${step >= n ? 'done' : ''} ${step === n ? 'active' : ''}`}>
                  <div className="progress-dot">
                    {step > n ? (
                      <svg width="8" height="8" viewBox="0 0 8 8"><path d="M1.5 4l2 2 3-3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
                    ) : null}
                  </div>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          ) : (
            <button className="activate-btn" onClick={startCamera}>
              Enable Hand Tracking
            </button>
          )}
        </div>
      )}
    </div>
  )
}
