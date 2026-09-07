'use client';

import { useEffect } from 'react';

export function Modal({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return undefined;
    function handleKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-lg border border-line bg-surface p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="text-slate hover:text-ink">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
