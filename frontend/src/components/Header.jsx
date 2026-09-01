// Header.jsx — greeting header: large light "What's up?", today's date (auto-
// updates at midnight), pin toggle, sync toggle, code motif. Full row is the
// drag region; buttons are no-drag.
import React, { useEffect, useState } from 'react';
import { CodeIcon, SyncIcon, PinIcon } from './icons.jsx';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** 'YYYY/MM/DD, Day' — e.g. '2026/09/01, Tuesday'. */
function todayLabel(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}/${m}/${day}, ${WEEKDAYS[d.getDay()]}`;
}

/** Re-renders at every local midnight so the date rolls over with the clock. */
function useTodayLabel() {
  const [label, setLabel] = useState(() => todayLabel());
  useEffect(() => {
    let timer;
    const schedule = () => {
      const now = new Date();
      const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      timer = setTimeout(() => {
        setLabel(todayLabel());
        schedule(); // re-arm for the following midnight
      }, nextMidnight - now + 2000);
    };
    schedule();
    return () => clearTimeout(timer);
  }, []);
  return label;
}

export default function Header({ syncing, onSync, isPinned, onTogglePin }) {
  const today = useTodayLabel();

  return (
    <div className="header header-drag">
      <div className="header-left">
        <div className="title">What&rsquo;s up?</div>
        <div className="today">{today}</div>
      </div>
      <div className="header-tools">
        <button
          type="button"
          className={`pin-toggle${isPinned ? ' pinned' : ''}`}
          style={{ WebkitAppRegion: 'no-drag' }}
          title={isPinned ? 'Always on top — click to unpin' : 'Pin on top (over fullscreen apps)'}
          aria-label="Toggle pin on top"
          aria-pressed={isPinned}
          onClick={onTogglePin}
        >
          <span className={`pin-glyph${isPinned ? ' rotated' : ''}`}>
            <PinIcon size={11} />
          </span>
        </button>
        <button
          type="button"
          className={`sync-toggle${syncing ? ' syncing' : ''}`}
          style={{ WebkitAppRegion: 'no-drag' }}
          title="Sync mail"
          aria-label="Sync mail"
          aria-busy={syncing}
          onClick={onSync}
        >
          {syncing ? (
            <span className="sync-spinner" />
          ) : (
            <span className="sync-glyph">
              <SyncIcon size={11} />
            </span>
          )}
        </button>
        <span className="header-code">
          <CodeIcon size={14} />
        </span>
      </div>
    </div>
  );
}
