const LABEL_COLORS = {
  Event:   { bg: '#e8f0fe', text: '#3b5bdb' },
  Archive: { bg: '#f1f3f5', text: '#868e96' },
  Review:  { bg: '#fff4e6', text: '#e67700' },
  Design:  { bg: '#f3e8ff', text: '#7c3aed' },
}

function NoteCard({ card }) {
  const labelStyle = LABEL_COLORS[card.label] || { bg: '#f1f3f5', text: '#666' }
  return (
    <>
      <div className="card-header">
        {card.label && (
          <span className="card-chip" style={{ background: labelStyle.bg, color: labelStyle.text }}>
            {card.label}
          </span>
        )}
        {card.date && <span className="card-date">{card.date}</span>}
      </div>
      <div className="card-title">{card.title}</div>
      <div className="card-divider" />
      {card.content && <div className="card-content">{card.content}</div>}
    </>
  )
}

function ImageCard({ card }) {
  return (
    <>
      <div className="card-image">
        <div className="card-image-grain" />
        <div className="card-image-overlay">
          <span className="card-image-label">{card.content}</span>
        </div>
      </div>
      <div className="card-header" style={{ marginTop: 10 }}>
        {card.label && (
          <span className="card-chip" style={{ background: '#f1f3f5', color: '#868e96' }}>
            {card.label}
          </span>
        )}
        {card.date && <span className="card-date">{card.date}</span>}
      </div>
      <div className="card-title" style={{ marginTop: 4 }}>{card.title}</div>
    </>
  )
}

function MiniCard({ card }) {
  return (
    <>
      <div className="card-mini-dot" />
      <div className="card-title" style={{ fontSize: 12 }}>{card.title}</div>
      {card.content && <div className="card-content" style={{ fontSize: 11, marginTop: 4 }}>{card.content}</div>}
    </>
  )
}

export default function Card({ card, isAnimating }) {
  const rotation = card.rotation || 0

  const style = {
    left: card.x,
    top: card.y,
    transform: `rotate(${rotation}deg)`,
    transition: isAnimating
      ? 'left 0.55s cubic-bezier(0.4, 0, 0.2, 1), top 0.55s cubic-bezier(0.4, 0, 0.2, 1), transform 0.55s cubic-bezier(0.4, 0, 0.2, 1)'
      : 'transform 0.2s ease',
  }

  return (
    <div
      className={`card ${card.type === 'mini' ? 'card-mini' : ''}`}
      style={style}
    >
      {card.type === 'image' && <ImageCard card={card} />}
      {card.type === 'note'  && <NoteCard  card={card} />}
      {card.type === 'mini'  && <MiniCard  card={card} />}
    </div>
  )
}
