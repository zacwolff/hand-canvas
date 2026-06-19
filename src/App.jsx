import { useEffect, useRef, useState, useCallback } from 'react'
import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'
import Card from './components/Card'
import './index.css'

const INITIAL_CARDS = [
  {
    id: 1, x: 80, y: 160, rotation: 0,
    title: '1:1 Design Catchup',
    type: 'note',
    content: 'Review the design system updates.\nAlign on component library direction.\nCheck spacing tokens before ship.',
    label: 'Event',
    date: 'Today',
  },
  {
    id: 2, x: 380, y: 90, rotation: 0,
    title: 'Concept · 2017',
    type: 'image',
    content: 'Fantastico',
    label: 'Archive',
    date: 'Jun 12',
  },
  {
    id: 3, x: 660, y: 170, rotation: 0,
    title: 'Prototype Review',
    type: 'note',
    content: 'Ship by end of Q2.\n\nThree things to verify before handoff.\nDesign tokens, spacing, motion.',
    label: 'Review',
    date: 'Jun 15',
  },
  {
    id: 4, x: 900, y: 80, rotation: 0,
    title: 'Notes',
    type: 'mini',
    content: 'Quick capture',
    label: null,
    date: null,
  },
]

const PINCH_THRESHOLD = 0.065
const CARD_W = 220
const CARD_H = 200
const PALM_HOLD_MS = 500

function isOpenPalm(lm) {
  // All four fingers extended: tip.y < pip.y (higher on screen = smaller Y value)
  return (
    lm[8].y  < lm[6].y  && // index
    lm[12].y < lm[10].y && // middle
    lm[16].y < lm[14].y && // ring
    lm[20].y < lm[18].y    // pinky
  )
}

export default function App() {
  const [cards, setCards] = useState(INITIAL_CARDS)
  const [handPos, setHandPos] = useState(null)
  const [isPinching, setIsPinching] = useState(false)
  const [palmProgress, setPalmProgress] = useState(0) // 0–1 fill as you hold
  const [isStacking, setIsStacking] = useState(false)
  const [draggingId, setDraggingId] = useState(null)
  const [camActive, setCamActive] = useState(false)
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(0)
  const [error, setError] = useState(null)
  const [deadzone, setDeadzone] = useState(10)
  const [smooth, setSmooth] = useState(0.1)

  const cardsRef = useRef(INITIAL_CARDS)
  const dragInfoRef = useRef(null)
  const prevPinchRef = useRef(false)
  const palmStartRef = useRef(null)
  const stackCooldownRef = useRef(false)
  const smoothPosRef = useRef(null) // smoothed hand position
  const videoRef = useRef(null)
  const animFrameRef = useRef(null)
  const handLandmarkerRef = useRef(null)

  const stackCards = useCallback(() => {
    const cx = window.innerWidth / 2 - CARD_W / 2
    const cy = window.innerHeight / 2 - CARD_H / 2
    const offsets = [-18, -6, 6, 18]
    const rotations = [-6, -2, 3, 7]
    const updated = cardsRef.current.map((c, i) => ({
      ...c,
      x: cx + offsets[i] * 1.5,
      y: cy + offsets[i],
      rotation: rotations[i],
    }))
    cardsRef.current = updated
    setIsStacking(true)
    setCards([...updated])
    setTimeout(() => setIsStacking(false), 650)
  }, [])

  const startCamera = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setStep(1)
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      )
      setStep(2)
      let landmarker
      try {
        landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 1,
        })
      } catch {
        landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'CPU',
          },
          runningMode: 'VIDEO',
          numHands: 1,
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
    setLoading(false)
    setStep(0)
  }, [])

  useEffect(() => {
    if (!camActive) return

    const detect = (timestamp) => {
      animFrameRef.current = requestAnimationFrame(detect)
      const video = videoRef.current
      const landmarker = handLandmarkerRef.current
      if (!video || !landmarker || video.readyState < 2 || video.paused) return

      const result = landmarker.detectForVideo(video, timestamp)

      if (!result.landmarks?.length) {
        setHandPos(null)
        setIsPinching(false)
        setPalmProgress(0)
        palmStartRef.current = null
        smoothPosRef.current = null
        if (prevPinchRef.current) {
          setDraggingId(null)
          prevPinchRef.current = false
          dragInfoRef.current = null
        }
        return
      }

      const lm = result.landmarks[0]
      const indexTip = lm[8]
      const thumbTip = lm[4]

      const rawX = (1 - indexTip.x) * window.innerWidth
      const rawY = indexTip.y * window.innerHeight

      if (!smoothPosRef.current) smoothPosRef.current = { x: rawX, y: rawY }
      const dx = rawX - smoothPosRef.current.x
      const dy = rawY - smoothPosRef.current.y
      const dist = Math.hypot(dx, dy)
      if (dist > deadzone) {
        smoothPosRef.current.x += dx * smooth
        smoothPosRef.current.y += dy * smooth
      }
      const x = smoothPosRef.current.x
      const y = smoothPosRef.current.y

      const pinchDist = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y)
      const pinching = pinchDist < PINCH_THRESHOLD

      setHandPos({ x, y })
      setIsPinching(pinching)

      // Palm gesture detection (only when not pinching)
      if (!pinching && isOpenPalm(lm)) {
        if (!palmStartRef.current) palmStartRef.current = timestamp
        const progress = Math.min((timestamp - palmStartRef.current) / PALM_HOLD_MS, 1)
        setPalmProgress(progress)
        if (progress >= 1 && !stackCooldownRef.current) {
          stackCards()
          stackCooldownRef.current = true
          palmStartRef.current = null
          setPalmProgress(0)
          setTimeout(() => { stackCooldownRef.current = false }, 1200)
        }
      } else {
        palmStartRef.current = null
        setPalmProgress(0)
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
          setDraggingId(hit.id)
        }
      } else if (!pinching && wasPinching) {
        dragInfoRef.current = null
        setDraggingId(null)
      }

      if (pinching && dragInfoRef.current) {
        const { cardId, offsetX, offsetY } = dragInfoRef.current
        const updated = cardsRef.current.map(c =>
          c.id === cardId ? { ...c, x: x - offsetX, y: y - offsetY, rotation: 0 } : c
        )
        cardsRef.current = updated
        setCards([...updated])
      }
    }

    animFrameRef.current = requestAnimationFrame(detect)
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [camActive, stackCards, deadzone, smooth])

  const handleMouseDown = useCallback((cardId, e) => {
    e.preventDefault()
    const card = cardsRef.current.find(c => c.id === cardId)
    if (!card) return

    dragInfoRef.current = {
      cardId,
      offsetX: e.clientX - card.x,
      offsetY: e.clientY - card.y,
    }
    setDraggingId(cardId)

    const onMove = (e) => {
      if (!dragInfoRef.current) return
      const { cardId, offsetX, offsetY } = dragInfoRef.current
      const updated = cardsRef.current.map(c =>
        c.id === cardId ? { ...c, x: e.clientX - offsetX, y: e.clientY - offsetY, rotation: 0 } : c
      )
      cardsRef.current = updated
      setCards([...updated])
    }

    const onUp = () => {
      dragInfoRef.current = null
      setDraggingId(null)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [])

  // SVG ring circumference for palm progress indicator
  const RING_R = 18
  const RING_C = 2 * Math.PI * RING_R

  return (
    <div className="canvas-root">
      {cards.map(card => (
        <Card
          key={card.id}
          card={card}
          isDragging={draggingId === card.id}
          isStacking={isStacking}
          onMouseDown={(e) => handleMouseDown(card.id, e)}
        />
      ))}

      {handPos && (
        <div
          className={`hand-cursor ${isPinching ? 'pinching' : ''} ${palmProgress > 0 ? 'palm' : ''}`}
          style={{ left: handPos.x, top: handPos.y }}
        >
          {palmProgress > 0 && (
            <svg className="palm-ring" width="44" height="44" viewBox="0 0 44 44">
              <circle cx="22" cy="22" r={RING_R} fill="none" stroke="rgba(0,0,0,0.12)" strokeWidth="2.5" />
              <circle
                cx="22" cy="22" r={RING_R}
                fill="none"
                stroke="rgba(0,0,0,0.7)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray={RING_C}
                strokeDashoffset={RING_C * (1 - palmProgress)}
                transform="rotate(-90 22 22)"
                style={{ transition: 'stroke-dashoffset 0.05s linear' }}
              />
            </svg>
          )}
        </div>
      )}

      <video
        ref={videoRef}
        className={camActive ? 'webcam-preview' : 'webcam-hidden'}
        muted
        playsInline
      />

      {camActive && (
        <>
          <div className="status">
            <div className="status-dot" />
            Open palm to stack · Pinch to drag
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
