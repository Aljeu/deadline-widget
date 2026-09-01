// Card.jsx — white bento card: category dot, subject, pin+source location line,
// bottom row (action_summary · urgency pill · time). Strikethrough + collapse on
// check, undo via rollback log.
import React, { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { CheckIcon, MapPinIcon } from './icons.jsx';

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

/** '2026-09-04 09:00' -> Date (parsed manually — Safari-safe). */
function parseDeadline(s) {
  if (!s) return null;
  const [datePart, timePart] = s.split(' ');
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh, mm] = (timePart || '00:00').split(':').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, hh || 0, mm || 0);
}

function urgencyOf(s) {
  const dt = parseDeadline(s);
  if (!dt) return null;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (dt < now) return 'OVERDUE';
  if (dt >= startOfToday && dt < new Date(startOfToday.getTime() + 24 * 3600 * 1000)) return 'TODAY';
  if (dt - now <= 7 * 24 * 3600 * 1000) return 'SOON';
  return null;
}

/** '2026-09-04 09:00' -> '11:59 PM' (time only, for the card's right side). */
function formatTime(s) {
  const dt = parseDeadline(s);
  if (!dt) return null;
  const hh = dt.getHours() % 12 || 12;
  const mm = String(dt.getMinutes()).padStart(2, '0');
  return `${hh}:${mm} ${dt.getHours() < 12 ? 'AM' : 'PM'}`;
}

export default function Card({ item, onCheck }) {
  const [checked, setChecked] = useState(false);
  const timer = useRef(null);

  const time = formatTime(item.deadline_date);
  const urgency = urgencyOf(item.deadline_date);
  const action = item.action_summary && !/no action/i.test(item.action_summary) ? item.action_summary : null;
  const isCourse = item.category_type === 'COURSE';

  const handleCheck = () => {
    if (checked) return;
    setChecked(true);
    // Strikethrough runs (0.22s); collapse + removal happen after 320ms.
    timer.current = setTimeout(() => onCheck(item.email_id), 320);
  };

  React.useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <div className={`card${checked ? ' card-checked' : ''}`} onClick={handleCheck}>
      <button
        type="button"
        className={`card-check${checked ? ' checked' : ''}`}
        style={{ WebkitAppRegion: 'no-drag' }}
        aria-label="Mark done"
        aria-pressed={checked}
        onClick={(e) => {
          e.stopPropagation();
          handleCheck();
        }}
      >
        {checked && (
          <span className="check-glyph">
            <CheckIcon size={11} />
          </span>
        )}
      </button>

      <div className="card-body">
        <div className="card-top">
          <span className={`cat-dot ${isCourse ? 'course' : 'announce'}`} />
          <div className={`card-subject${checked ? ' struck' : ''}`}>
            {item.subject}
            {checked && (
              <motion.span
                className="card-strikethrough"
                style={{ width: '100%' }}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
              />
            )}
          </div>
        </div>

        <div className="card-meta">
          <span className="meta-pin">
            <MapPinIcon size={9} />
          </span>
          <span>{item.source || '—'}</span>
        </div>

        <div className="card-bottom">
          {action && <span className="card-action">{action}</span>}
          {urgency && (
            <span className={`tag ${urgency === 'SOON' ? 'tag-muted' : 'tag-accent'}`}>{urgency}</span>
          )}
          {time && <span className="card-time">{time}</span>}
        </div>
      </div>
    </div>
  );
}
