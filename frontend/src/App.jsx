// App.jsx — orchestrator: load cards (API → mock fallback), paginate, check with undo, sync.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import Header from './components/Header.jsx';
import CardList, { PAGE_SIZE } from './components/CardList.jsx';
import Toast from './components/Toast.jsx';
import { StarIcon } from './components/icons.jsx';
import { MOCK_CARDS } from './mockData.js';
import * as api from './api.js';

/**
 * Adapter: backend card -> UI schema.
 * Backend: { id, subject, course_code, sender, deadline_date, action_summary, status, created_at }
 * UI:      { email_id, subject, category_type: COURSE|ANNOUNCEMENT, source, sender, deadline_date, action_summary }
 */
function mapApiCard(c) {
  return {
    email_id: String(c.id),
    subject: c.subject,
    category_type: c.course_code ? 'COURSE' : 'ANNOUNCEMENT',
    source: c.course_code || 'College of Engineering',
    sender: c.sender,
    deadline_date: c.deadline_date || '',
    action_summary: c.action_summary || '',
  };
}

/** Real API when reachable (live deadlines); static mock data during pure-frontend dev. */
async function loadCards() {
  try {
    const data = await api.getCards();
    if (data && Array.isArray(data.cards) && data.cards.length > 0) {
      return data.cards.map(mapApiCard);
    }
  } catch { /* backend down — fall through to mock */ }
  return MOCK_CARDS;
}

/** Same ordering the backend uses: deadline asc (nulls/empty last), then email_id. */
function sortCards(cards) {
  return [...cards].sort((a, b) => {
    const da = a.deadline_date || '';
    const db = b.deadline_date || '';
    if (da === db) return String(a.email_id).localeCompare(String(b.email_id));
    if (!da) return 1;
    if (!db) return -1;
    return da.localeCompare(db);
  });
}

export default function App() {
  const [cards, setCards] = useState([]);
  const [page, setPage] = useState(0);
  const [dir, setDir] = useState(1);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState(null);
  const [isPinned, setIsPinned] = useState(() => {
    try { return localStorage.getItem('deadlinePinned') === 'true'; } catch { return false; }
  });
  const rollbackRef = useRef(null); // latest rollback_id for undo

  const pageCount = useMemo(() => Math.max(1, Math.ceil(cards.length / PAGE_SIZE)), [cards]);

  const load = useCallback(async () => {
    try {
      const data = await loadCards();
      setCards(sortCards(data));
    } catch {
      setToast({ kind: 'error', message: 'Offline — retrying' });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Apply the persisted pin preference to the OS window on mount.
  useEffect(() => {
    if (window.deadlineAPI && window.deadlineAPI.setAlwaysOnTop) {
      window.deadlineAPI.setAlwaysOnTop(isPinned);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTogglePin = useCallback(() => {
    setIsPinned((prev) => {
      const next = !prev;
      try { localStorage.setItem('deadlinePinned', String(next)); } catch { /* persist best-effort */ }
      if (window.deadlineAPI && window.deadlineAPI.setAlwaysOnTop) {
        window.deadlineAPI.setAlwaysOnTop(next);
      }
      return next;
    });
  }, []);

  // Clamp the page when cards shrink (e.g. checking the last card of a page).
  useEffect(() => {
    if (page >= pageCount) setPage(Math.max(0, pageCount - 1));
  }, [page, pageCount]);

  const handleCheck = useCallback(
    async (emailId) => {
      const idx = cards.findIndex((c) => c.email_id === emailId);
      if (idx === -1) return;
      const removed = cards[idx];
      setCards((prev) => prev.filter((c) => c.email_id !== emailId));
      try {
        // Mock items aren't in the backend — treat as instantly cleared with a
        // client-side rollback; real items go through the API + rollback log.
        const numericId = Number(emailId);
        if (Number.isInteger(numericId) && numericId > 0) {
          const res = await api.checkCard(numericId);
          rollbackRef.current = res.rollback_id;
        } else {
          rollbackRef.current = `mock-${emailId}`;
        }
        setToast({ kind: 'cleared', message: 'Cleared', rollback_id: rollbackRef.current });
      } catch {
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
      if (String(rollbackId).startsWith('mock-')) {
        // Restore the mock card (look it up from the source list).
        const emailId = String(rollbackId).replace('mock-', '');
        const card = MOCK_CARDS.find((c) => c.email_id === emailId);
        if (card) setCards((prev) => sortCards([...prev, card]));
      } else {
        const res = await api.undo(rollbackId);
        if (res.ok && res.card) {
          const restored = mapApiCard(res.card);
          setCards((prev) => sortCards([...prev.filter((c) => c.email_id !== restored.email_id), restored]));
        }
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
      <Header syncing={syncing} onSync={handleSync} isPinned={isPinned} onTogglePin={handleTogglePin} />

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
