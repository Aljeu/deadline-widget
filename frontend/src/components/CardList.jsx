// CardList.jsx — pagination row (range + chevrons + indicator) and the
// direction-aware sliding page of cards.
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

export default function CardList({ cards, dir, onCheck, onNavigate, page, pageCount, total }) {
  const from = page * PAGE_SIZE + 1;
  const to = Math.min(total, page * PAGE_SIZE + PAGE_SIZE);

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
              {cards.map((card) => (
                <motion.div
                  key={card.id}
                  layout
                  exit={cardExit}
                  style={{ overflow: 'hidden' }}
                >
                  <Card card={card} onCheck={onCheck} />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  );
}
