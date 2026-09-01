// Card.jsx — floating pure-white bento card: checkbox (strikethrough + collapse),
// subject, sender, action, deadline with urgency tag.
import React, { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { CalendarIcon, CheckIcon } from './icons.jsx';

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

/** '2026-09-04 09:00' -> 'THU 04 SEP · 09:00 AM' (or 'THU 04 SEP' if no time). */
export function formatDeadline(s) {
  const dt = parseDeadline(s);
  if (!dt) return null;
  const day = DAYS[dt.getDay()];
  const date = String(dt.getDate()).padStart(2, '0');
  const month = MONTHS[dt.getMonth()];
  const hh24 = dt.getHours();
  const hh = hh24 % 12 || 12;
  const mm = String(dt.getMinutes()).padStart(2, '0');
  const ampm = hh24 < 12 ? 'AM' : 'PM';
  const hasTime = /\d{2}:\d{2}/.test(s);
  return hasTime ? `${day} ${date} ${month} · ${hh}:${mm} ${ampm}` : `${day} ${date} ${month}`;
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

function senderName(sender) {
  if (!sender) return '';
  const m = sender.match(/^([^<]+)</);
  return (m ? m[1] : sender).trim();
}

export default function Card({ item, onCheck }) {
  const [checked, setChecked] = useState(false);
  const timer = useRef(null);

  const deadline = formatDeadline(item.deadline_date);
  const urgency = urgencyOf(item.deadline_date);
  const action = item.action_summary && !/no action/i.test(item.action_summary) ? item.action_summary : null;

  const handleCheck = () => {
    if (checked) return;
    setChecked(true);
    // Strikethrough runs (0.22s); collapse + removal happen after 320ms.
    timer.current = setTimeout(() => onCheck(item.email_id), 320);
  };

  // Safety: clear the pending timer if the card unmounts early.
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

        <div className="card-meta">
          {item.source}
          {item.sender ? ` · ${senderName(item.sender)}` : ''}
        </div>

        {action && <div className="card-action">{action}</div>}

        <div className="card-deadline">
          <span className="cal">
            <CalendarIcon size={11} />
          </span>
          {deadline ? (
            <span>{deadline}</span>
          ) : (
            <span className="no-date">No date</span>
          )}
          {urgency && (
            <span className={`tag ${urgency === 'SOON' ? 'tag-muted' : 'tag-accent'}`}>{urgency}</span>
          )}
        </div>
      </div>
    </div>
  );
}
