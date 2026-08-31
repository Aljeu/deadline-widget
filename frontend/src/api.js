// api.js — tiny fetch wrapper for the local backend.
const BASE = (window.deadlineAPI && window.deadlineAPI.baseUrl) || 'http://127.0.0.1:8766';

async function req(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const getCards = () => req('/api/cards');
export const checkCard = (id) => req(`/api/cards/${id}/check`, { method: 'POST' });
export const undo = (rollbackId) =>
  req('/api/undo', { method: 'POST', body: JSON.stringify(rollbackId != null ? { rollback_id: rollbackId } : {}) });
export const sync = () => req('/api/sync', { method: 'POST' });
export const health = () => req('/api/health');
