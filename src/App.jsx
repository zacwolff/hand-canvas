import { useEffect, useRef, useState, useCallback } from 'react'
import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'
import Card from './components/Card'
import './index.css'

const CARD_DATA = [
  {
    id: 1,
    title: '1:1 Design Catchup',
    type: 'note',
    content: 'Review token updates.\nAlign on component direction.\nCheck spacing before ship.',
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
    content: 'Ship by end of Q2.\nVerify: tokens, spacing, motion.\nHandoff checklist pending.',
    label: 'Review',
    date: 'Jun 15',
  },
  {
    id: 4,
    title: 'Quick Note',
    type: 'mini',
    content: 'Follow up with eng on breakpoints',
    label: null,
    date: null,
  },
  {
    id: 5,
    title: 'Motion Principles',
    type: 'note',
    content: 'Spring curves only.\nEase out for entrances.\nNever animate layout shifts.',
    label: 'Design',
    date: 'Jun 18',
  },
  {
    id: 6,
    title: 'Brand Refresh',
    type: 'image',
    content: 'Visual Identity',
    label: 'Archive',
    date: 'May 30',
  },
  {
    id: 7,
    title: 'Accessibility Audit',
    type: 'note',
    content: 'Color contrast failing on 3 components.\nKeyboard nav missing in modal.\nTarget: WCAG AA.',
    label: 'Review',
    date: 'Jun 10',
  },
  {
    id: 8,
    title: 'Sprint Goals',
    type: 'mini',
    content: 'Ship nav redesign by Friday',
    label: null,
    date: null,
  },
  {
    id: 9,
    title: 'Component Audit',
    type: 'note',
    content: 'Consolidate 4 button variants → 2.\nRemove deprecated Alert.\nDocument all props.',
    label: 'Design',
    date: 'Jun 17',
  },
  {
    id: 10,
    title: 'User Interview #4',
    type: 'note',
    content: 'Users miss the old nav.\nSearch is the #1 pain point.\nWant more keyboard shortcuts.',
    label: 'Review',
    date: 'Jun 14',
  },
  {
    id: 11,
    title: 'Exploration · Nav',
    type: 'image',
    content: 'Navigation',
    label: 'Archive',
    date: 'Jun 8',
  },
  {
    id: 12,
    title: 'Ship it',
    type: 'mini',
    content: 'Don\'t let perfect block good',
    label: null,
    date: null,
  },
  {
    id: 13,
    title: 'Dark Mode Pass',
    type: 'note',
    content: 'Semantic color tokens only.\nNo hardcoded hex in components.\nTest with system preference.',
    label: 'Design',
    date: 'Jun 16',
  },
  {
    id: 14,
    title: 'Onboarding Flow',
    type: 'note',
    content: 'Step 1: value prop.\nStep 2: first action.\nStep 3: aha moment.\nDrop-off at step 2.',
    label: 'Review',
    date: 'Jun 11',
  },
  {
    id: 15,
    title: 'Type Scale · v3',
    type: 'image',
    content: 'Typography',
    label: 'Archive',
    date: 'May 22',
  },
  {
    id: 16,
    title: 'Focus',
    type: 'mini',
    content: 'One thing per sprint',
    label: null,
    date: null,
  },
  {
    id: 17,
    title: 'Icon Library',
    type: 'note',
    content: '240 icons audited.\nReduce to 80 core set.\nOutline style only, 20px grid.',
    label: 'Design',
    date: 'Jun 13',
  },
  {
    id: 18,
    title: 'Handoff Checklist',
    type: 'note',
    content: 'Specs exported.\nTokens documented.\nEdge cases annotated.\nDev sync scheduled.',
    label: 'Event',
    date: 'Jun 19',
  },
]

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
  const rotations = [-8,-5,-3,-1,1,3,5,7,-6,-4,-2,0,2,4,6,-7,-3,2]
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
    const gap = 32
    const n = cardsRef.current.length
    const cols = Math.min(Math.floor((window.innerWidth - 80) / (CARD_W + gap)), Math.ceil(Math.sqrt(n * 1.6)))
    const rows = Math.ceil(n / cols)
    const totalW = cols * CARD_W + (cols - 1) * gap
    const totalH = rows * CARD_H + (rows - 1) * gap
    const startX = (window.innerWidth  - totalW) / 2
    const startY = Math.max(32, (window.innerHeight - totalH) / 2)
    const updated = cardsRef.current.map((c, i) => ({
      ...c,
      x: startX + (i % cols) * (CARD_W + gap),
      y: startY + Math.floor(i / cols) * (CARD_H + gap),
      rotation: 0, vx: 0, vy: 0,
    }))
    cardsRef.current = updated
    setIsAnimating(true)
    setCards([...updated])
    setTimeout(() => setIsAnimating(false), 650)
  }, [])

  const groupCards = useCallback(() => {
    const types = ['note', 'image', 'mini']
    const cx = [0.22, 0.5, 0.78].map(p => p * window.innerWidth - CARD_W / 2)
    const cy = window.innerHeight / 2 - CARD_H / 2
    const rots = [
      [-6,-3,0,2,-4,-1,3,-2,1,-5],
      [-5,-1,3,7],
      [-4,0,5,-6],
    ]
    const next = [...cardsRef.current]
    types.forEach((type, ti) => {
      const group = next.filter(c => c.type === type)
      group.forEach((c, i) => {
        const idx = next.findIndex(n => n.id === c.id)
        next[idx] = {
          ...c,
          x: cx[ti] + i * 14,
          y: cy + i * 10,
          rotation: rots[ti][i % rots[ti].length],
          vx: 0, vy: 0,
        }
      })
    })
    cardsRef.current = next
    setIsAnimating(true)
    setCards([...next])
    setTimeout(() => setIsAnimating(false), 650)
  }, [])

  const stackCards = useCallback(() => {
    const cx = window.innerWidth / 2 - CARD_W / 2
    const cy = window.innerHeight / 2 - CARD_H / 2
    const rotations = [-8,-5,-3,-1,1,3,5,7,-6,-4,-2,0,2,4,6,-7,-3,2]
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
          isDragging={false}
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

      {camActive && (
        <>
          <div className="status">
            <div className="status-dot" />
            Open palm → spread · Fist → stack · ✌️ → group
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
