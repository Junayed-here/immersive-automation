'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { scopedApi } from '@/lib/adminApi';

const DELIVERY_STATUS_TONE = { sent: 'success', failed: 'danger', skipped: 'neutral', pending: 'copper' };
const RUN_STATUS_TONE = { completed: 'success', partial: 'copper', failed: 'danger', running: 'verdigris', queued: 'neutral' };

export default function RunDetailPage({ params }) {
  const { realtorId, automationId, runId } = params;
  const scoped = scopedApi(realtorId);
  const [run, setRun] = useState(null);
  const [deliveries, setDeliveries] = useState([]);
  const [viewing, setViewing] = useState(null);
  const [viewingHtml, setViewingHtml] = useState('');
  const [retryingId, setRetryingId] = useState(null);
  const [loadError, setLoadError] = useState('');

  function load() {
    setLoadError('');
    scoped
      .get(`/runs/${runId}`)
      .then((data) => {
        setRun(data.run);
        setDeliveries(data.deliveries);
      })
      .catch((err) => setLoadError(err.message || 'Failed to load this run.'));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [runId]);

  async function openEmail(delivery) {
    setViewing(delivery);
    setViewingHtml('');
    if (delivery.renderedHtml) {
      const data = await scoped.get(`/deliveries/${delivery._id}/html`);
      setViewingHtml(data.html);
    }
  }

  async function handleRetry(delivery) {
    setRetryingId(delivery._id);
    try {
      await scoped.post(`/deliveries/${delivery._id}/retry`);
      load();
    } finally {
      setRetryingId(null);
    }
  }

  if (loadError && !run) {
    return <div className="rounded border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">{loadError}</div>;
  }
  if (!run) return <p className="text-sm text-slate">Loading…</p>;

  return (
    <div>
      <PageHeader
        eyebrow={
          <Link href={`/admin/clients/${realtorId}/automations/${automationId}`} className="hover:underline">
            ← Back to automation
          </Link>
        }
        title="Run detail"
        meta={`${run.trigger} · started ${new Date(run.startedAt).toLocaleString()}`}
      />

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardBody>
            <div className="text-xs uppercase tracking-wide text-slate">Buyers</div>
            <div className="font-mono text-2xl font-semibold text-ink">
              {run.stats.buyersMatched}/{run.stats.buyersProcessed}
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="text-xs uppercase tracking-wide text-slate">Status</div>
            <Badge tone={RUN_STATUS_TONE[run.status] || 'neutral'}>{run.status}</Badge>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="text-xs uppercase tracking-wide text-slate">Listings fetched</div>
            <div className="font-mono text-2xl font-semibold text-ink">{run.stats.listingsFetched}</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="text-xs uppercase tracking-wide text-slate">Sent / Skipped / Failed</div>
            <div className="font-mono text-lg text-ink">
              {run.stats.emailsSent} / {run.stats.emailsSkipped} / {run.stats.emailsFailed}
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="mt-8">
        <h2 className="font-display text-lg font-semibold text-ink">Per-buyer deliveries</h2>
        <Card className="mt-3">
          <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wide text-slate">
                <th className="px-5 py-3 font-medium">Buyer</th>
                <th className="px-5 py-3 font-medium">Matched listings</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {deliveries.map((delivery) => (
                <tr key={delivery._id} className="border-b border-line last:border-0">
                  <td className="px-5 py-3">
                    <div className="font-medium text-ink">{delivery.buyerId?.name || 'Deleted buyer'}</div>
                    <div className="text-xs text-slate">{delivery.buyerId?.email}</div>
                  </td>
                  <td className="px-5 py-3 font-mono text-xs">{delivery.listingIds.length}</td>
                  <td className="px-5 py-3">
                    <Badge tone={DELIVERY_STATUS_TONE[delivery.status] || 'neutral'}>{delivery.skipReason || delivery.status}</Badge>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {delivery.renderedHtml ? (
                      <button onClick={() => openEmail(delivery)} className="mr-3 text-xs font-medium text-verdigris-dark hover:underline">
                        View email
                      </button>
                    ) : null}
                    {delivery.status === 'failed' ? (
                      <button
                        onClick={() => handleRetry(delivery)}
                        disabled={retryingId === delivery._id}
                        className="text-xs font-medium text-danger hover:underline disabled:opacity-50"
                      >
                        {retryingId === delivery._id ? 'Retrying…' : 'Retry'}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </Card>
      </div>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing?.subject || 'Email'}>
        <div className="h-[500px] w-[520px] max-w-full overflow-hidden rounded border border-line bg-white">
          {viewingHtml ? (
            <iframe title="Delivered email" srcDoc={viewingHtml} className="h-full w-full" />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate">Loading…</div>
          )}
        </div>
      </Modal>
    </div>
  );
}
