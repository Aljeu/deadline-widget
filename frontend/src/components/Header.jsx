// Header.jsx — drag region, star motif, DEADLINES title, pin toggle, sync toggle, code motif.
import React from 'react';
import { StarIcon, CodeIcon, SyncIcon, PinIcon } from './icons.jsx';

export default function Header({ syncing, onSync, isPinned, onTogglePin }) {
  return (
    <div className="header header-drag">
      <span className="header-star">
        <StarIcon size={13} />
      </span>
      <span className="title">Deadlines</span>
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
          <PinIcon size={10} />
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
            <SyncIcon size={10} />
          </span>
        )}
      </button>
      <span className="header-code">
        <CodeIcon size={13} />
      </span>
    </div>
  );
}
