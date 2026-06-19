function NowPlayingCard({ card }) {
  return (
    <>
      <div className="np-bg" style={{ background: card.gradient }} />
      <div className="np-noise" />
      <div className="np-inner">
        <div className="np-label">Now Playing</div>
        <div className="np-title">{card.title}</div>
        <div className="np-artist">{card.artist}</div>
        <div className="np-bar">
          <div className="np-fill" style={{ width: `${card.progress * 100}%` }} />
        </div>
        <div className="np-time">
          <span>{card.time}</span>
          <span>{card.duration}</span>
        </div>
      </div>
    </>
  )
}

function WeatherCard({ card }) {
  return (
    <>
      <div className="widget-label">{card.city}</div>
      <div className="weather-temp">
        {card.temp}<span className="weather-unit">{card.unit}</span>
      </div>
      <div className="weather-condition">{card.condition}</div>
      <div className="weather-hilo">
        <span className="weather-hi">H: {card.hi}°</span>
        <span className="weather-lo">L: {card.lo}°</span>
      </div>
    </>
  )
}

function CalendarCard({ card }) {
  return (
    <>
      <div className="cal-header">
        <div className="widget-label" style={{ margin: 0 }}>Today</div>
        <div className="cal-date">Thu, Jun 19</div>
      </div>
      {card.events.map((ev, i) => (
        <div key={i} className="cal-event">
          <div className="cal-dot" style={{ background: ev.color }} />
          <div className="cal-event-title">{ev.title}</div>
          <div className="cal-event-time">{ev.time}</div>
        </div>
      ))}
    </>
  )
}

function TasksCard({ card }) {
  return (
    <>
      <div className="widget-label">Focus</div>
      {card.items.map((item, i) => (
        <div key={i} className="task-item">
          <div className="task-circle" />
          <span>{item}</span>
        </div>
      ))}
    </>
  )
}

function HomeCard({ card }) {
  const lights = Array.from({ length: card.lightsTotal }, (_, i) => i < card.lightsOn)
  return (
    <>
      <div className="widget-label">{card.room}</div>
      <div className="home-temp">{card.temp}<span>°F</span></div>
      <div className="home-lights-label">{card.lightsOn} of {card.lightsTotal} lights on</div>
      <div className="home-lights">
        {lights.map((on, i) => (
          <div key={i} className={`home-light-dot ${on ? 'on' : 'off'}`} />
        ))}
      </div>
    </>
  )
}

function StatCard({ card }) {
  return (
    <>
      <div className="stat-glow" style={{ background: card.accent }} />
      <div className="widget-label">{card.label}</div>
      <div className="stat-value">{card.value}</div>
      <div className="stat-sub">{card.sub}</div>
    </>
  )
}

function FeedCard({ card }) {
  return (
    <>
      <div className="widget-label">{card.title}</div>
      {card.items.map((item, i) => (
        <div key={i} className="feed-item">{item}</div>
      ))}
    </>
  )
}

function MediaCard({ card }) {
  return (
    <>
      <div className="media-bg" style={{ background: card.gradient }} />
      <div className="np-noise" />
      <div className="media-inner">
        <div className="media-label">{card.label}</div>
        <div className="media-title">{card.show}</div>
        <div className="media-ep">{card.episode}</div>
      </div>
    </>
  )
}

export default function Card({ card, isAnimating }) {
  const rotation = card.rotation || 0
  const isGradient = card.type === 'now-playing' || card.type === 'media'

  const style = {
    left: card.x,
    top: card.y,
    transform: `rotate(${rotation}deg)`,
    transition: isAnimating
      ? 'left 0.55s cubic-bezier(0.4, 0, 0.2, 1), top 0.55s cubic-bezier(0.4, 0, 0.2, 1), transform 0.55s cubic-bezier(0.4, 0, 0.2, 1)'
      : 'transform 0.2s ease',
  }

  return (
    <div className={`card${isGradient ? ' card-gradient' : ''}`} style={style}>
      {card.type === 'now-playing' && <NowPlayingCard card={card} />}
      {card.type === 'weather'     && <WeatherCard    card={card} />}
      {card.type === 'calendar'    && <CalendarCard   card={card} />}
      {card.type === 'tasks'       && <TasksCard      card={card} />}
      {card.type === 'home'        && <HomeCard       card={card} />}
      {card.type === 'stat'        && <StatCard       card={card} />}
      {card.type === 'feed'        && <FeedCard       card={card} />}
      {card.type === 'media'       && <MediaCard      card={card} />}
    </div>
  )
}
