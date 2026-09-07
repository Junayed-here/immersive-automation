'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

/**
 * A styled stand-in for window.confirm() for destructive actions, so they
 * match the rest of the product instead of dropping into native browser
 * chrome. `onConfirm` may be async; the confirm button disables while it runs.
 */
export function ConfirmModal({ open, onClose, title = 'Are you sure?', body, confirmLabel = 'Confirm', onConfirm }) {
  const [busy, setBusy] = useState(false);

  async function handleConfirm() {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={title}>
      {body ? <p className="text-sm text-slate">{body}</p> : null}
      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button type="button" variant="danger" onClick={handleConfirm} disabled={busy}>
          {busy ? 'Working…' : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
