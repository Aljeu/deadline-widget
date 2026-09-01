// CardList.jsx — schedule list grouped by date on a left rail. Left: a date block
// per row (featured/urgent date = filled near-black block). Right: floating white
// bento cards. Direction-aware slide pagination + range/chevron indicator.
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Card from './Card.jsx';

export const PAGE_SIZE = 4;
const EASE = [0.22, 1, 0.36, 1];

const pageVariants = {
  enter: (dir) => ({ x: dir * 48, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir) => ({ x: -dir * 48, opacity: 0 }),
};

const cardExit = {
  opacity: 0,
  height: 0,
  marginBottom: 0,
  transition: { duration: 0.25, ease: EASE },
};

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function parsed(s) {
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return { day: String(Number(m[3])).padStart(2, '0'), mon: MONTHS[Number(m[2]) - 1] };
}

function urgencyOf(s) {
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (!m) return null;
  const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (dt < now) return 'OVERDUE';
  if (dt >= startOfToday && dt < new Date(startOfToday.getTime() + 24 * 3600 * 1000)) return 'TODAY';
  if (dt - now <= 7 * 24 * 3600 * 1000) return 'SOON';
  return null;
}

export default function CardList({ cards, dir, onCheck, onNavigate, page, pageCount, total }) {
  const from = page * PAGE_SIZE + 1;
  const to = Math.min(total, page * PAGE_SIZE + PAGE_SIZE);

  // The soonest deadline on the page is the "featured" date (like the phone app's
  // highlighted block) — unless a row is already overdue/today, which also pops.
  const soonestIdx = cards.reduce(
    (best, c, i) => (c.deadline_date && (!cards[best].deadline_date || c.deadline_date < cards[best].deadline_date) ? i : best),
    0
  );

  return (
    <>
      <div className="pagination-row">
        <span className="range">
          Deadline {String(from).padStart(2, '0')} — {String(to).padStart(2, '0')}
        </span>
        <span className="page-controls">
          <button
            type="button"
            className="page-prev"
            style={{ WebkitAppRegion: 'no-drag' }}
            aria-label="Previous page"
            disabled={page === 0}
            onClick={() => onNavigate(-1)}
          >
            ‹
          </button>
          <span className={`page-indicator${pageCount > 1 ? ' multi' : ''}`}>
            {page + 1}/{pageCount}
          </span>
          <button
            type="button"
            className="page-next"
            style={{ WebkitAppRegion: 'no-drag' }}
            aria-label="Next page"
            disabled={page >= pageCount - 1}
            onClick={() => onNavigate(1)}
          >
            ›
          </button>
        </span>
      </div>

      <div className="card-list">
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <motion.div
            key={page}
            className="card-page"
            custom={dir}
            variants={pageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.35, ease: EASE }}
          >
            <AnimatePresence initial={false}>
              {cards.map((item, idx) => {
                const d = parsed(item.deadline_date);
                const urg = urgencyOf(item.deadline_date);
                const u = idx === soonestIdx || urg === 'OVERDUE' || urg === 'TODAY';
                return (
                  <motion.div key={item.email_id} layout exit={cardExit} style={{ overflow: 'hidden' }}>
                    <div className="tl-row">
                      <div className={`tl-rail${u ? ' featured' : ''}`}>
                        <span className="rail-day">{d ? d.day : '—'}</span>
                        <span className="rail-mon">{d ? d.mon : 'N/A'}</span>
                      </div>
                      <Card item={item} onCheck={onCheck} />
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  );
}
