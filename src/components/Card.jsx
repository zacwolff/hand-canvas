export default function Card({ card, isDragging, onMouseDown }) {
  return (
    <div
      className={`card ${card.type === 'mini' ? 'card-mini' : ''} ${isDragging ? 'dragging' : ''}`}
      style={{ left: card.x, top: card.y }}
      onMouseDown={onMouseDown}
    >
      {card.label && <div className="card-label">{card.label}</div>}

      {card.type === 'image' && (
        <div className="card-image">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" opacity="0.35">
            <rect x="3" y="3" width="18" height="18" rx="2" stroke="#555" strokeWidth="1.5" />
            <circle cx="8.5" cy="8.5" r="1.5" fill="#555" />
            <path d="M3 16l5-5 4 4 3-3 6 6" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}

      <div className="card-title">{card.title}</div>

      {card.content && <div className="card-content">{card.content}</div>}

      {card.date && <div className="card-date">{card.date}</div>}
    </div>
  )
}
