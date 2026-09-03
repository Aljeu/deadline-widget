// Header.jsx — warm greeting (time-of-day + first name), live time-of-day mark,
// humanized date, and a control trio: time mark · refresh · pin.
import React, { useEffect, useState } from 'react';
import { SyncIcon, PinIcon, timeStateForHour } from './icons.jsx';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function greeting(h) {
  if (h >= 4 && h < 12) return 'Good morning';
  if (h >= 12 && h < 18) return 'Good afternoon';
  return 'Good evening';
}

function humanDate(d = new Date()) {
  return `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

function clockFull(d = new Date()) {
  let h = d.getHours() % 12;
  if (h === 0) h = 12;
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
}

export default function Header({ name, summary, syncing, onSync, isPinned, onTogglePin }) {
  const [now, setNow] = useState(() => new Date());
  const [seconds, setSeconds] = useState(() => new Date());

  // Re-render every 10s so the greeting, mark, and date stay in sync
  // across minute/hour/sunset boundaries (and on wake).
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(id);
  }, []);

  // 1-second ticker just for the live clock tooltip.
  useEffect(() => {
    const id = setInterval(() => setSeconds(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const h = now.getHours();
  const { Mark, cls } = timeStateForHour(h);
  const firstName = (name || '').split(/\s+/)[0];
  const greetText = greeting(h);

  return (
    <div className="header header-drag">
      <div className="header-left">
        <div className="greet">
          {greetText}, <span className="name">{name ? `${firstName}` : 'There'}</span>
          <span className="bang">!</span>
        </div>
        <div className="summary">{summary}</div>
        <div className="today">{humanDate(now)}</div>
      </div>

      <div className="header-tools">
        <span className={`tool time-mark ${cls}`} aria-label={greetText}>
          <span className="glyph"><Mark /></span>
          <span className="tool-tip" role="tooltip">{clockFull(seconds)}</span>
        </span>
        <button
          type="button"
          className="tool refresh"
          style={{ WebkitAppRegion: 'no-drag' }}
          title="Sync mail"
          aria-label="Sync mail"
          aria-busy={syncing}
          onClick={onSync}
        >
          <span className="glyph">{syncing ? <span className="sync-spinner" /> : <SyncIcon size={12} />}</span>
        </button>
        <button
          type="button"
          className={`tool pin${isPinned ? ' pinned' : ''}`}
          style={{ WebkitAppRegion: 'no-drag' }}
          title={isPinned ? 'Always on top — click to unpin' : 'Pin on top (over fullscreen apps)'}
          aria-label="Toggle pin on top"
          aria-pressed={isPinned}
          onClick={onTogglePin}
        >
          <span className={`glyph${isPinned ? ' rot' : ''}`}><PinIcon size={12} /></span>
        </button>
      </div>
    </div>
  );
}
