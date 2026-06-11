import { useState } from 'react'
import { KARAT_TRACKS } from '../karatContent'

export default function KaratAssessment() {
  const [active, setActive] = useState(KARAT_TRACKS[0].id)
  const track = KARAT_TRACKS.find((t) => t.id === active)

  return (
    <div>
      <h1 className="page-title">KARAT Assessment Prep</h1>
      <p className="page-sub">
        Role-based preparation for the KARAT assessment — the concepts that matter and practice questions for each track.
      </p>

      <div className="tabs">
        {KARAT_TRACKS.map((t) => (
          <button
            key={t.id}
            className={`tab ${active === t.id ? 'active' : ''}`}
            onClick={() => setActive(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <p className="page-sub" style={{ marginTop: 4 }}>{track.blurb}</p>

      <h3 className="section-title">Study Guide</h3>
      <div className="karat-guide">
        {track.guide.map((g) => (
          <div className="card karat-topic" key={g.topic}>
            <h4>{g.topic}</h4>
            <p>{g.detail}</p>
          </div>
        ))}
      </div>

      <h3 className="section-title">Practice Questions</h3>
      <div className="card karat-qa">
        {track.questions.map((qa, i) => (
          <details key={i} className="qa">
            <summary>{qa.q}</summary>
            <p>{qa.a}</p>
          </details>
        ))}
      </div>
    </div>
  )
}
