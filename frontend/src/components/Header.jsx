// Header.jsx — drag region, star motif, DEADLINES title, sync toggle, code motif.
import React from 'react';
import { StarIcon, CodeIcon, SyncIcon } from './icons.jsx';

export default function Header({ syncing, onSync }) {
  return (
    <div className="header header-drag">
      <span className="header-star">
        <StarIcon size={13} />
      </span>
      <span className="title">Deadlines</span>
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
