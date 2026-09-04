// Card.jsx — strong status-bubble card. Anatomy: [check LEFT] · title/status/course+date · [star RIGHT].
// No category dot, no redundant action line. Status shown by the bubble tint + a chip.
import React from 'react';
import { CheckIcon, StarOutlineIcon, StarFilledIcon } from './icons.jsx';
import { statusClass, badgeFor, relLabel, timeOnly } from '../deadline.js';

export default function Card({ item, done, priority, onToggleDone, onTogglePriority }) {
  const sc = statusClass(item.deadline_date);
  const badge = badgeFor(item.deadline_date);
  const when = `${relLabel(item.deadline_date)} ${timeOnly(item.deadline_date)}`.trim();

  return (
    <div className={`card ${sc}${priority ? ' priority' : ''}`}>
      <button
        type="button"
        className={`card-check${done ? ' checked' : ''}`}
        style={{ WebkitAppRegion: 'no-drag' }}
        aria-label={done ? 'Mark not done' : 'Mark done'}
        aria-pressed={done}
        onClick={(e) => { e.stopPropagation(); onToggleDone(item.email_id); }}
      >
        {done && <span className="check-glyph"><CheckIcon size={11} /></span>}
      </button>

      <div className="card-body">
        <div className={`card-subject${done ? ' struck' : ''}`}>{item.subject}</div>
        <div className="card-status"><span className="chip">{badge}</span></div>
        <div className="card-meta">
          <span className="m-course">{item.source || '—'}</span>
          {when ? <><span className="m-dot">·</span><span className="m-when">{when}</span></> : null}
        </div>
      </div>

      <button
        type="button"
        className={`card-star${priority ? ' starred' : ''}`}
        style={{ WebkitAppRegion: 'no-drag' }}
        aria-label={priority ? 'Remove top priority' : 'Mark top priority'}
        aria-pressed={priority}
        onClick={(e) => { e.stopPropagation(); onTogglePriority(item.email_id); }}
      >
        <span className="star-glyph">{priority ? <StarFilledIcon size={15} /> : <StarOutlineIcon size={15} />}</span>
      </button>
    </div>
  );
}
