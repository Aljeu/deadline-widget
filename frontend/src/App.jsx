// App.jsx — orchestrator: load cards, paginate, check with undo, sync.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import Header from './components/Header.jsx';
import CardList, { PAGE_SIZE } from './components/CardList.jsx';
import Toast from './components/Toast.jsx';
import { StarIcon } from './components/icons.jsx';
import * as api from './api.js';

/** Same ordering the backend uses: deadline asc (nulls last), then created_at desc. */
function sortCards(cards) {
  return [...cards].sort((a, b) => {
    if (a.deadline_date === b.deadline_date) return String(b.created_at).localeCompare(String(a.created_at));
    if (!a.deadline_date) return 1;
    if (!b.deadline_date) return -1;
    return String(a.deadline_date).localeCompare(String(b.deadline_date));
  });
}

export default function App() {
  const [cards, setCards] = useState([]);
  const [page, setPage] = useState(0);
  const [dir, setDir] = useState(1);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState(null);
  const rollbackRef = useRef(null); // latest rollback_id for undo

  const pageCount = useMemo(() => Math.max(1, Math.ceil(cards.length / PAGE_SIZE)), [cards]);

  const load = useCallback(async () => {
    try {
      const data = await api.getCards();
      setCards(sortCards(data.cards || []));
    } catch {
      setToast({ kind: 'error', message: 'Offline — retrying' });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Clamp the page when cards shrink (e.g. checking the last card of a page).
  useEffect(() => {
    if (page >= pageCount) setPage(Math.max(0, pageCount - 1));
  }, [page, pageCount]);

  const handleCheck = useCallback(
    async (id) => {
      const idx = cards.findIndex((c) => c.id === id);
      if (idx === -1) return;
      const removed = cards[idx];
      setCards((prev) => prev.filter((c) => c.id !== id));
      try {
        const res = await api.checkCard(id);
        rollbackRef.current = res.rollback_id;
        setToast({ kind: 'cleared', message: 'Cleared', rollback_id: res.rollback_id });
      } catch {
        // Restore at the original position.
        setCards((prev) => {
          const next = [...prev];
          next.splice(Math.min(idx, next.length), 0, removed);
          return next;
        });
        setToast({ kind: 'error', message: 'Check failed' });
      }
    },
    [cards]
  );

  const handleUndo = useCallback(async () => {
    const rollbackId = toast && toast.rollback_id != null ? toast.rollback_id : rollbackRef.current;
    setToast(null);
    if (rollbackId == null) return;
    try {
      const res = await api.undo(rollbackId);
      if (res.ok && res.card) {
        setCards((prev) => sortCards([...prev.filter((c) => c.id !== res.card.id), res.card]));
      }
    } catch {
      setToast({ kind: 'error', message: 'Undo failed' });
    }
  }, [toast]);

  const handleSync = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const res = await api.sync();
      if (res.ok) {
        await load();
        const msg = res.extracted > 0 ? `Synced · +${res.extracted} new` : 'No new mail';
        setToast({ kind: 'synced', message: msg });
      } else {
        setToast({ kind: 'error', message: res.detail || res.error || 'Sync failed' });
      }
    } catch (err) {
      setToast({
        kind: 'error',
        message: err && err.name === 'AbortError' ? 'Sync timed out — try again' : 'Offline — retrying',
      });
    } finally {
      setSyncing(false);
    }
  }, [syncing, load]);

  const handleNavigate = useCallback(
    (direction) => {
      setDir(direction);
      setPage((p) => Math.max(0, Math.min(pageCount - 1, p + direction)));
    },
    [pageCount]
  );

  const pageCards = useMemo(() => {
    const start = page * PAGE_SIZE;
    return cards.slice(start, start + PAGE_SIZE);
  }, [cards, page]);

  return (
    <div className="app">
      <Header syncing={syncing} onSync={handleSync} />

      {cards.length > 0 ? (
        <CardList
          cards={pageCards}
          dir={dir}
          onCheck={handleCheck}
          onNavigate={handleNavigate}
          page={page}
          pageCount={pageCount}
          total={cards.length}
        />
      ) : (
        <div className="empty-state">
          <span className="star-big">
            <StarIcon size={20} />
          </span>
          <span className="empty-title">No deadlines</span>
          <span className="empty-hint">Sync to check</span>
          <button
            type="button"
            className="empty-sync"
            style={{ WebkitAppRegion: 'no-drag' }}
            onClick={handleSync}
            disabled={syncing}
          >
            {syncing ? 'Syncing…' : 'Sync now'}
          </button>
        </div>
      )}

      <AnimatePresence>
        {toast && (
          <Toast key={toast.rollback_id ?? toast.message} toast={toast} onUndo={handleUndo} onDismiss={() => setToast(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
