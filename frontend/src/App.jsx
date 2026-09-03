// App.jsx — load cards (API → mock fallback), drive checked/priority state,
// conversational task-count summary, finished-task cleanup modal, window auto-height.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import Header from './components/Header.jsx';
import CardList from './components/CardList.jsx';
import Toast from './components/Toast.jsx';
import { StarIcon, TrashIcon } from './components/icons.jsx';
import { MOCK_CARDS } from './mockData.js';
import * as api from './api.js';
import { parseDeadline, urgencyOf } from './deadline.js';

/** Backend card -> UI schema. */
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

async function loadCards() {
  try {
    const data = await api.getCards();
    if (data && Array.isArray(data.cards) && data.cards.length > 0) {
      return data.cards.map(mapApiCard);
    }
  } catch {
    /* backend down — fall through to mock */
  }
  return MOCK_CARDS;
}

/** Deadline asc (nulls last), then email id. */
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
  const [doneIds, setDoneIds] = useState(() => new Set());
  const [priorityIds, setPriorityIds] = useState(() => new Set());
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState(null);
  const [isPinned, setIsPinned] = useState(() => {
    try { return localStorage.getItem('deadlinePinned') === 'true'; } catch { return false; }
  });
  const [name, setName] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);
  const appRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const data = await loadCards();
      setCards(sortCards(data));
    } catch {
      setToast({ kind: 'error', message: 'Offline — retrying' });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Device owner name (first name only) via preload IPC; neutral fallback.
  // Runtime reads the local owner — no name hardcoded in this repo.
  useEffect(() => {
    if (window.deadlineAPI && window.deadlineAPI.getOwnerName) {
      window.deadlineAPI.getOwnerName()
        .then((full) => { if (full && full.trim()) setName(full.trim()); })
        .catch(() => {});
    }
  }, []);

  // Apply persisted pin preference to the OS window on mount.
  useEffect(() => {
    if (window.deadlineAPI && window.deadlineAPI.setAlwaysOnTop) {
      window.deadlineAPI.setAlwaysOnTop(isPinned);
    }
  }, []);

  // Window auto-height: report the rendered widget height so the frameless window hugs content.
  useEffect(() => {
    if (!window.deadlineAPI || !window.deadlineAPI.setContentHeight) return undefined;
    const report = () => {
      if (appRef.current) window.deadlineAPI.setContentHeight(appRef.current.offsetHeight);
    };
    report();
    const id = setInterval(report, 500);
    return () => clearInterval(id);
  }, [cards, doneIds, priorityIds, toast]);

  const handleTogglePin = useCallback(() => {
    setIsPinned((prev) => {
      const next = !prev;
      try { localStorage.setItem('deadlinePinned', String(next)); } catch { /* best-effort */ }
      if (window.deadlineAPI && window.deadlineAPI.setAlwaysOnTop) window.deadlineAPI.setAlwaysOnTop(next);
      return next;
    });
  }, []);

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

  const toggleDone = useCallback((id) => {
    setDoneIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const togglePriority = useCallback((id) => {
    setPriorityIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setResetSignal((s) => s + 1); // jump back to the front so the starred card is visible
  }, []);

  const openModal = useCallback(() => {
    if (doneIds.size > 0) setModalOpen(true);
  }, [doneIds]);

  const closeModal = useCallback(() => setModalOpen(false), []);

  const deleteDone = useCallback(async () => {
    const count = doneIds.size;
    const toRemove = new Set(doneIds);
    setCards((prev) => prev.filter((c) => !toRemove.has(c.email_id)));
    setDoneIds(new Set());
    setModalOpen(false);
    setResetSignal((s) => s + 1);
    // Persist real deletions to the backend (mock items are client-side only).
    const real = [...toRemove].filter((id) => /^\d+$/.test(id));
    for (const id of real) {
      try { await api.checkCard(id); } catch { /* best-effort */ }
    }
    setToast({ kind: 'deleted', message: `${count} finished task${count > 1 ? 's' : ''} removed` });
  }, [doneIds]);

  // Priorities float to the top, each group sorted by deadline.
  const ordered = useMemo(() => {
    const pri = [], rest = [];
    for (const c of cards) (priorityIds.has(c.email_id) ? pri : rest).push(c);
    return [...sortCards(pri), ...sortCards(rest)];
  }, [cards, priorityIds]);

  const checkedCount = doneIds.size;

  const summary = useMemo(() => {
    let over = 0, tod = 0, wk = 0;
    for (const c of cards) {
      const u = urgencyOf(c.deadline_date);
      if (u === 'OVERDUE') over++;
      else if (u === 'TODAY') tod++;
      else if (u === 'SOON') wk++;
    }
    const parts = [];
    if (over) parts.push(<span className="n-danger" key="o">{over} overdue</span>);
    if (tod) parts.push(<span className="n-today" key="t">{tod} due today</span>);
    if (wk) parts.push(<span className="n-week" key="w">{wk} this week</span>);
    if (parts.length > 1) return <>You have {parts.slice(0, -1).map((p, i) => <span key={i}>{p}{', '}</span>)}{parts[parts.length - 1]}.</>;
    if (parts.length === 1) return <>You have {parts[0]} right now.</>;
    return <>Nothing due this week — you're all clear!</>;
  }, [cards]);

  return (
    <div className="app" ref={appRef}>
      <Header
        name={name}
        summary={summary}
        syncing={syncing}
        onSync={handleSync}
        isPinned={isPinned}
        onTogglePin={handleTogglePin}
      />

      {ordered.length > 0 ? (
        <CardList
          cards={ordered}
          doneIds={doneIds}
          priorityIds={priorityIds}
          checkedCount={checkedCount}
          onToggleDone={toggleDone}
          onTogglePriority={togglePriority}
          onClearDone={openModal}
          resetSignal={resetSignal}
        />
      ) : (
        <div className="empty-state">
          <span className="star-big"><StarIcon size={22} /></span>
          <span className="empty-title">All clear — nothing due</span>
          <span className="empty-hint">sync to check mail</span>
          <button type="button" className="empty-sync" style={{ WebkitAppRegion: 'no-drag' }} onClick={handleSync} disabled={syncing}>
            {syncing ? 'Syncing…' : 'Sync now'}
          </button>
        </div>
      )}

      <AnimatePresence>
        {toast && <Toast key={toast.message} toast={toast} onDismiss={() => setToast(null)} />}
      </AnimatePresence>

      {/* confirmation modal — overlays the widget */}
      <div className={`modal-backdrop${modalOpen ? ' show' : ''}`} onClick={closeModal}>
        <div className="modal" role="dialog" aria-modal="true">
          <div className="modal-icon"><TrashIcon size={22} /></div>
          <div className="modal-title">Delete finished tasks?</div>
          <div className="modal-body">
            You have <b>{checkedCount}</b> finished task{checkedCount > 1 ? 's' : ''}. This can't be undone.
          </div>
          <div className="modal-actions">
            <button type="button" className="mbtn cancel" onClick={closeModal}>Cancel</button>
            <button type="button" className="mbtn confirm" onClick={deleteDone}>Delete</button>
          </div>
        </div>
      </div>
    </div>
  );
}
