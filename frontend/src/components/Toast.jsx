// Toast.jsx — bottom toast with Undo state (auto-dismiss 6s).
import React, { useEffect } from 'react';
import { motion } from 'motion/react';

export default function Toast({ toast, onUndo, onDismiss }) {
  const { kind, message, rollback_id } = toast;

  useEffect(() => {
    if (kind === 'error') return undefined;
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [kind, rollback_id, onDismiss]);

  return (
    <motion.div
      className="toast"
      role="status"
      initial={{ y: 24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 24, opacity: 0 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
    >
      <span className="toast-msg">{message}</span>
      {kind === 'cleared' && rollback_id != null && (
        <button type="button" className="toast-undo" onClick={onUndo}>
          Undo
        </button>
      )}
    </motion.div>
  );
}
