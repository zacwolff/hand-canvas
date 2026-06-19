import { useEffect, useRef, useState, useCallback } from 'react'
import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'
import Card from './components/Card'
import './index.css'

const CARD_DATA = [
  {
    id: 1,
    title: '1:1 Design Catchup',
    type: 'note',
    content: 'Review the design system updates.\nAlign on component library direction.\nCheck spacing tokens before ship.',
    label: 'Event',
    date: 'Today',
  },
  {
    id: 2,
    title: 'Concept · 2017',
    type: 'image',
    content: 'Fantastico',
    label: 'Archive',
    date: 'Jun 12',
  },
  {
    id: 3,
    title: 'Prototype Review',
    type: 'note',
    content: 'Ship by end of Q2.\n\nThree things to verify before handoff.\nDesign tokens, spacing, motion.',
    label: 'Review',
    date: 'Jun 15',
  },
  {
    id: 4,
    title: 'Notes',
    type: 'mini',
    content: 'Quick capture',
    label: null,
    date: null,
  },
]

const PINCH_THRESHOLD = 0.065
const CARD_W = 220
const CARD_H = 180
const GESTURE_HOLD_MS = 500
const FRICTION = 0.82
const MAX_VEL = 30
const MIN_VEL = 0.15
const NUDGE = 0.6

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

function makeCards() {
  const cx = window.innerWidth  / 2 - CARD_W / 2
  const cy = window.innerHeight / 2 - CARD_H / 2
  const rotations = [-5, -1.5, 2.5, 6]
  return shuffle(CARD_DATA).map((c, i) => ({
    ...c,
    x: cx,
    y: cy,
    rotation: rotations[i],
    vx: 0, vy: 0,
  }))
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
  const [isPinching, setIsPinching] = useState(false)
  const [gestureProgress, setGestureProgress] = useState(0)
  const [activeGesture, setActiveGesture] = useState(null) // 'bento' | 'stack' | null
  const [isAnimating, setIsAnimating] = useState(false)
  const [draggingId, setDraggingId] = useState(null)
  const [camActive, setCamActive] = useState(false)
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(0)
  const [error, setError] = useState(null)
  const [deadzone, setDeadzone] = useState(10)
  const [smooth, setSmooth] = useState(0.1)

  const cardsRef = useRef(cards)
  const dragInfoRef = useRef(null)
  const prevPinchRef = useRef(false)
  const gestureStartRef = useRef(null)
  const gestureCooldownRef = useRef(false)
  const currentGestureRef = useRef(null)
  const smoothPosRef = useRef(null)
  const dragVelRef = useRef({ vx: 0, vy: 0 })
  const lastDragPosRef = useRef(null)
  const physicsFrameRef = useRef(null)
  const videoRef = useRef(null)
  const overlayCanvasRef = useRef(null)
  const animFrameRef = useRef(null)
  const handLandmarkerRef = useRef(null)

  // Physics loop
  useEffect(() => {
    const tick = () => {
      physicsFrameRef.current = requestAnimationFrame(tick)
      const draggingCardId = dragInfoRef.current?.cardId
      let dirty = false

      let next = cardsRef.current.map(card => {
        if (card.id === draggingCardId) return card
        let { x, y, vx, vy } = card
        if (!vx && !vy) return card

        x += vx; y += vy
        vx *= FRICTION; vy *= FRICTION
        if (Math.abs(vx) < MIN_VEL) vx = 0
        if (Math.abs(vy) < MIN_VEL) vy = 0

        const maxX = window.innerWidth  - CARD_W
        const maxY = window.innerHeight - CARD_H
        if (x < 0)    { x = 0;    vx =  Math.abs(vx) * 0.35 }
        if (x > maxX) { x = maxX; vx = -Math.abs(vx) * 0.35 }
        if (y < 0)    { y = 0;    vy =  Math.abs(vy) * 0.35 }
        if (y > maxY) { y = maxY; vy = -Math.abs(vy) * 0.35 }

        dirty = true
        return { ...card, x, y, vx, vy }
      })

      for (let i = 0; i < next.length; i++) {
        for (let j = i + 1; j < next.length; j++) {
          const a = next[i], b = next[j]
          const dx = (a.x + CARD_W / 2) - (b.x + CARD_W / 2)
          const dy = (a.y + CARD_H / 2) - (b.y + CARD_H / 2)
          const ox = CARD_W - Math.abs(dx)
          const oy = CARD_H - Math.abs(dy)
          if (ox <= 0 || oy <= 0) continue
          dirty = true
          const aDragged = a.id === draggingCardId
          const bDragged = b.id === draggingCardId
          if (ox < oy) {
            const push = ox * NUDGE * Math.sign(dx)
            if (!aDragged) next[i] = { ...next[i], vx: Math.max(-MAX_VEL, Math.min(MAX_VEL, (next[i].vx || 0) + push)) }
            if (!bDragged) next[j] = { ...next[j], vx: Math.max(-MAX_VEL, Math.min(MAX_VEL, (next[j].vx || 0) - push)) }
          } else {
            const push = oy * NUDGE * Math.sign(dy)
            if (!aDragged) next[i] = { ...next[i], vy: Math.max(-MAX_VEL, Math.min(MAX_VEL, (next[i].vy || 0) + push)) }
            if (!bDragged) next[j] = { ...next[j], vy: Math.max(-MAX_VEL, Math.min(MAX_VEL, (next[j].vy || 0) - push)) }
          }
        }
      }

      if (dirty) { cardsRef.current = next; setCards([...next]) }
    }
    physicsFrameRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(physicsFrameRef.current)
  }, [])

  const spreadCards = useCallback(() => {
    const n = cardsRef.current.length
    const totalW = n * CARD_W + (n - 1) * 32
    const startX = (window.innerWidth - totalW) / 2
    const cy = window.innerHeight / 2 - CARD_H / 2
    const yOffsets = [-40, 30, -20, 50] // vary heights for natural feel
    const updated = cardsRef.current.map((c, i) => ({
      ...c,
      x: startX + i * (CARD_W + 32),
      y: cy + yOffsets[i % yOffsets.length],
      rotation: 0, vx: 0, vy: 0,
    }))
    cardsRef.current = updated
    setIsAnimating(true)
    setCards([...updated])
    setTimeout(() => setIsAnimating(false), 650)
  }, [])

  const stackCards = useCallback(() => {
    const cx = window.innerWidth / 2 - CARD_W / 2
    const cy = window.innerHeight / 2 - CARD_H / 2
    const rotations = [-5, -1.5, 2.5, 6]
    const updated = cardsRef.current.map((c, i) => ({
      ...c,
      x: cx,
      y: cy,
      rotation: rotations[i],
      vx: 0, vy: 0,
    }))
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
        setHandPos(null); setIsPinching(false)
        setGestureProgress(0); setActiveGesture(null)
        gestureStartRef.current = null; currentGestureRef.current = null
        smoothPosRef.current = null
        if (canvas) drawHandOverlay(canvas, null)
        if (prevPinchRef.current && dragInfoRef.current) {
          const { cardId } = dragInfoRef.current
          const { vx, vy } = dragVelRef.current
          cardsRef.current = cardsRef.current.map(c => c.id === cardId ? { ...c, vx, vy } : c)
          dragInfoRef.current = null; setDraggingId(null)
          prevPinchRef.current = false
          dragVelRef.current = { vx: 0, vy: 0 }; lastDragPosRef.current = null
        }
        return
      }

      const lm = result.landmarks[0]
      if (canvas) drawHandOverlay(canvas, lm)

      const indexTip = lm[8], thumbTip = lm[4]
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

      const pinchDist = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y)
      const pinching = pinchDist < PINCH_THRESHOLD
      setHandPos({ x, y }); setIsPinching(pinching)

      // Gesture detection
      if (!pinching) {
        const palm = isOpenPalm(lm)
        const fist = !palm && isFist(lm)
        const gesture = palm ? 'bento' : fist ? 'stack' : null

        if (gesture && gesture === currentGestureRef.current) {
          if (!gestureStartRef.current) gestureStartRef.current = timestamp
          const progress = Math.min((timestamp - gestureStartRef.current) / GESTURE_HOLD_MS, 1)
          setGestureProgress(progress)
          setActiveGesture(gesture)
          if (progress >= 1 && !gestureCooldownRef.current) {
            gesture === 'bento' ? spreadCards() : stackCards()
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
      } else {
        currentGestureRef.current = null
        gestureStartRef.current = null
        setGestureProgress(0); setActiveGesture(null)
      }

      // Pinch drag
      const wasPinching = prevPinchRef.current
      prevPinchRef.current = pinching

      if (pinching && !wasPinching) {
        const hit = [...cardsRef.current].reverse().find(c =>
          x >= c.x && x <= c.x + CARD_W && y >= c.y && y <= c.y + CARD_H
        )
        if (hit) {
          dragInfoRef.current = { cardId: hit.id, offsetX: x - hit.x, offsetY: y - hit.y }
          dragVelRef.current = { vx: 0, vy: 0 }
          lastDragPosRef.current = { x, y, t: timestamp }
          setDraggingId(hit.id)
        }
      } else if (!pinching && wasPinching) {
        if (dragInfoRef.current) {
          const { cardId } = dragInfoRef.current
          const { vx, vy } = dragVelRef.current
          cardsRef.current = cardsRef.current.map(c => c.id === cardId ? { ...c, vx, vy } : c)
        }
        dragInfoRef.current = null; setDraggingId(null)
        dragVelRef.current = { vx: 0, vy: 0 }; lastDragPosRef.current = null
      }

      if (pinching && dragInfoRef.current) {
        const { cardId, offsetX, offsetY } = dragInfoRef.current
        const newX = x - offsetX, newY = y - offsetY
        if (lastDragPosRef.current) {
          const dt = timestamp - lastDragPosRef.current.t
          if (dt > 0) {
            const rvx = ((newX - lastDragPosRef.current.x) / dt) * 16
            const rvy = ((newY - lastDragPosRef.current.y) / dt) * 16
            dragVelRef.current.vx = dragVelRef.current.vx * 0.6 + rvx * 0.4
            dragVelRef.current.vy = dragVelRef.current.vy * 0.6 + rvy * 0.4
          }
        }
        lastDragPosRef.current = { x: newX, y: newY, t: timestamp }
        const updated = cardsRef.current.map(c =>
          c.id === cardId ? { ...c, x: newX, y: newY, vx: 0, vy: 0, rotation: 0 } : c
        )
        cardsRef.current = updated; setCards([...updated])
      }
    }

    animFrameRef.current = requestAnimationFrame(detect)
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current) }
  }, [camActive, spreadCards, stackCards, deadzone, smooth])


  const RING_R = 18
  const RING_C = 2 * Math.PI * RING_R
  const ringColor = activeGesture === 'bento' ? 'rgba(80,160,255,0.85)' : 'rgba(0,0,0,0.7)'

  return (
    <div className="canvas-root">
      {cards.map(card => (
        <Card
          key={card.id}
          card={card}
          isDragging={draggingId === card.id}
          isAnimating={isAnimating}
        />
      ))}

      {handPos && (
        <div
          className={`hand-cursor ${isPinching ? 'pinching' : ''} ${activeGesture ? 'gesture' : ''}`}
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

      {camActive && (
        <>
          <div className="status">
            <div className="status-dot" />
            Open palm → bento · Fist → stack · Pinch → drag
          </div>
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
