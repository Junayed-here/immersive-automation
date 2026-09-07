'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/Button';

export default function UnsubscribePage({ params }) {
  const { token } = params;
  const [state, setState] = useState({ status: 'loading' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api
      .get(`/api/public/unsubscribe/${token}`)
      .then((data) => setState({ status: data.alreadyUnsubscribed ? 'done' : 'confirm', email: data.email }))
      .catch((err) => setState({ status: 'error', message: err instanceof ApiError ? err.message : 'Something went wrong.' }));
  }, [token]);

  async function handleConfirm() {
    setSubmitting(true);
    try {
      const data = await api.post(`/api/public/unsubscribe/${token}`);
      setState({ status: 'done', email: data.email });
    } catch (err) {
      setState({ status: 'error', message: err instanceof ApiError ? err.message : 'Something went wrong.' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm rounded-lg border border-line bg-surface p-8 text-center">
        <div className="mb-4 font-display text-xl font-semibold text-ink">Ledger</div>
        {state.status === 'loading' ? <p className="text-sm text-slate">Loading…</p> : null}
        {state.status === 'confirm' ? (
          <div>
            <p className="text-sm text-ink">
              Unsubscribe <strong>{state.email}</strong> from listing emails?
            </p>
            <Button className="mt-4 w-full" onClick={handleConfirm} disabled={submitting}>
              {submitting ? 'Unsubscribing…' : 'Yes, unsubscribe me'}
            </Button>
          </div>
        ) : null}
        {state.status === 'done' ? (
          <p className="text-sm text-ink">
            <strong>{state.email}</strong> has been unsubscribed from listing emails. You won&apos;t receive any more
            digests unless you ask your realtor to re-subscribe you.
          </p>
        ) : null}
        {state.status === 'error' ? <p className="text-sm text-danger">{state.message}</p> : null}
      </div>
    </div>
  );
}
