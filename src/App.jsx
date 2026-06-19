import { useEffect, useRef, useState, useCallback } from 'react'
import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'
import Card from './components/Card'
import './index.css'

const INITIAL_CARDS = [
  {
    id: 1, x: 80, y: 160,
    title: '1:1 Design Catchup',
    type: 'note',
    content: 'Review the design system updates.\nAlign on component library direction.\nCheck spacing tokens before ship.',
    label: 'Event',
    date: 'Today',
  },
  {
    id: 2, x: 380, y: 90,
    title: 'Concept · 2017',
    type: 'image',
    content: 'Fantastico',
    label: 'Archive',
    date: 'Jun 12',
  },
  {
    id: 3, x: 660, y: 170,
    title: 'Prototype Review',
    type: 'note',
    content: 'Ship by end of Q2.\n\nThree things to verify before handoff.\nDesign tokens, spacing, motion.',
    label: 'Review',
    date: 'Jun 15',
  },
  {
    id: 4, x: 900, y: 80,
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

export default function App() {
  const [cards, setCards] = useState(INITIAL_CARDS)
  const [handPos, setHandPos] = useState(null)
  const [isPinching, setIsPinching] = useState(false)
  const [draggingId, setDraggingId] = useState(null)
  const [camActive, setCamActive] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [error, setError] = useState(null)

  const cardsRef = useRef(INITIAL_CARDS)
  const dragInfoRef = useRef(null)
  const prevPinchRef = useRef(false)
  const videoRef = useRef(null)
  const animFrameRef = useRef(null)
  const handLandmarkerRef = useRef(null)

  const startCamera = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setLoadingMsg('Loading WASM runtime…')
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      )

      setLoadingMsg('Loading hand model…')
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
        // GPU failed, fall back to CPU
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

      setLoadingMsg('Requesting camera…')
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      videoRef.current.srcObject = stream
      await videoRef.current.play()
      setCamActive(true)
    } catch (err) {
      console.error('Hand tracking init failed:', err)
      setError('Could not start — check camera permissions and try again.')
    }
    setLoading(false)
    setLoadingMsg('')
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
        if (prevPinchRef.current) {
          setIsPinching(false)
          setDraggingId(null)
          prevPinchRef.current = false
          dragInfoRef.current = null
        }
        return
      }

      const lm = result.landmarks[0]
      const indexTip = lm[8]
      const thumbTip = lm[4]

      // Flip X — webcam is mirrored
      const x = (1 - indexTip.x) * window.innerWidth
      const y = indexTip.y * window.innerHeight

      const pinchDist = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y)
      const pinching = pinchDist < PINCH_THRESHOLD

      setHandPos({ x, y })
      setIsPinching(pinching)

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
          c.id === cardId ? { ...c, x: x - offsetX, y: y - offsetY } : c
        )
        cardsRef.current = updated
        setCards([...updated])
      }
    }

    animFrameRef.current = requestAnimationFrame(detect)
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [camActive])

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
        c.id === cardId ? { ...c, x: e.clientX - offsetX, y: e.clientY - offsetY } : c
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

  return (
    <div className="canvas-root">
      {cards.map(card => (
        <Card
          key={card.id}
          card={card}
          isDragging={draggingId === card.id}
          onMouseDown={(e) => handleMouseDown(card.id, e)}
        />
      ))}

      {handPos && (
        <div
          className={`hand-cursor ${isPinching ? 'pinching' : ''}`}
          style={{ left: handPos.x, top: handPos.y }}
        />
      )}

      <video
        ref={videoRef}
        className={camActive ? 'webcam-preview' : 'webcam-hidden'}
        muted
        playsInline
      />

      {camActive && (
        <div className="status">
          <div className="status-dot" />
          Hand tracking active
        </div>
      )}

      {!camActive && (
        <div style={{ position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          {error && <div style={{ fontSize: 12, color: '#e55', background: 'rgba(255,255,255,0.9)', padding: '6px 14px', borderRadius: 100 }}>{error}</div>}
          <button className="activate-btn" onClick={startCamera} disabled={loading}>
            {loading ? (loadingMsg || 'Loading…') : 'Enable Hand Tracking'}
          </button>
        </div>
      )}
    </div>
  )
}
