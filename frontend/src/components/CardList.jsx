// CardList.jsx — fit-based pagination (no scrollbar; overflow flows to the next page),
// priority-featured date block, and the finished-task cleanup (trash) button.
// The date rail + Card bubble are rendered here; each card still keeps its own controls.
import React, { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import Card from './Card.jsx';
import { TrashIcon } from './icons.jsx';
import { parseDeadline, MONTHS } from '../deadline.js';

const CARD_AREA = 400; // available vertical space for the card list (px)
const GAP = 11;

function railDate(s) {
  const d = parseDeadline(s);
  if (!d) return { day: '—', mon: 'N/A' };
  return { day: String(d.getDate()).padStart(2, '0'), mon: MONTHS[d.getMonth()] };
}

export default function CardList({
  cards,
  doneIds,
  priorityIds,
  checkedCount,
  onToggleDone,
  onTogglePriority,
  onClearDone,
  resetSignal,
}) {
  // Measure a probe card (2-line title = tallest) to derive how many fit per page.
  const probeRef = useRef(null);
  const [probeH, setProbeH] = useState(0);
  useLayoutEffect(() => {
    if (probeRef.current) setProbeH(probeRef.current.offsetHeight);
  }, []);

  const pageSize = useMemo(() => {
    const h = probeH || 84;
    return Math.max(1, Math.floor((CARD_AREA + GAP) / (h + GAP)));
  }, [probeH]);

  const pageCount = Math.max(1, Math.ceil(cards.length / pageSize));
  const [page, setPage] = useState(0);
  useEffect(() => {
    setPage((p) => Math.min(p, Math.max(0, pageCount - 1)));
  }, [pageCount]);

  // When asked to re-sort (priority toggle / delete), return to the first page.
  useEffect(() => {
    if (resetSignal) setPage(0);
  }, [resetSignal]);

  const from = page * pageSize;
  const slice = cards.slice(from, from + pageSize);
  const to = from + slice.length;

  const nav = (dir) => setPage((p) => Math.max(0, Math.min(pageCount - 1, p + dir)));

  return (
    <>
      <div className="pagination-row">
        <span className="range">Deadline {slice.length ? `${from + 1}–${to}` : '0'}</span>
        <div className="pgrp">
          <button type="button" className="page-prev" style={{ WebkitAppRegion: 'no-drag' }} aria-label="Previous page" disabled={page === 0} onClick={() => nav(-1)}>‹</button>
          <span className={`page-indicator${pageCount > 1 ? ' multi' : ''}`}>{page + 1}/{pageCount}</span>
          <button type="button" className="page-next" style={{ WebkitAppRegion: 'no-drag' }} aria-label="Next page" disabled={page >= pageCount - 1} onClick={() => nav(1)}>›</button>
          <button
            type="button"
            className={`clear-done${checkedCount > 0 ? ' active' : ''}`}
            style={{ WebkitAppRegion: 'no-drag' }}
            title={checkedCount > 0 ? `Delete ${checkedCount} finished task${checkedCount > 1 ? 's' : ''}` : 'No finished tasks yet'}
            aria-label="Delete finished tasks"
            disabled={checkedCount === 0}
            onClick={onClearDone}
          >
            <span className="trash-glyph"><TrashIcon size={12} /></span>
            <span className="done-count">{checkedCount}</span>
          </button>
        </div>
      </div>

      <div className="card-list">
        {slice.map((item) => {
          const rd = railDate(item.deadline_date);
          const pri = priorityIds.has(item.email_id);
          return (
            <div className="tl-row" key={item.email_id}>
              <div className={`tl-rail${pri ? ' featured' : ''}`}>
                <span className="rail-day">{rd.day}</span>
                <span className="rail-mon">{rd.mon}</span>
              </div>
              <Card
                item={item}
                done={doneIds.has(item.email_id)}
                priority={pri}
                onToggleDone={onToggleDone}
                onTogglePriority={onTogglePriority}
              />
            </div>
          );
        })}
      </div>

      {/* hidden probe: tallest card, used to determine page size */}
      <div style={{ position: 'absolute', left: -9999, visibility: 'hidden', width: 318 }} aria-hidden="true">
        <div ref={probeRef} className="card status-rest" style={{ width: '100%' }}>
          <div className="card-body">
            <div className="card-subject">Lg 0123456789 1123456789 2123456789 3123456789 4123456789</div>
            <div className="card-status"><span className="chip">Upcoming</span></div>
            <div className="card-meta"><span className="m-course">COURSE 101</span><span className="m-dot">·</span><span className="m-when">Today 11:59 PM</span></div>
          </div>
        </div>
      </div>
    </>
  );
}
