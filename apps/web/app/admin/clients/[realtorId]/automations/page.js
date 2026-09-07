'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { describeSchedule } from '@/components/ScheduleEditor';
import { describeAudience } from '@/components/AudienceEditor';
import { scopedApi } from '@/lib/adminApi';

const STATUS_TONE = { active: 'success', paused: 'copper', draft: 'neutral' };

export default function AutomationsPage({ params }) {
  const { realtorId } = params;
  const scoped = scopedApi(realtorId);
  const [automations, setAutomations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pagination, setPagination] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [loadError, setLoadError] = useState('');

  function load() {
    setLoading(true);
    setLoadError('');
    scoped
      .get('/automations')
      .then((data) => {
        setAutomations(data.automations);
        setPagination(data.pagination);
      })
      .catch((err) => setLoadError(err.message || 'Failed to load automations.'))
      .finally(() => setLoading(false));
  }

  async function loadMore() {
    setLoadingMore(true);
    try {
      const data = await scoped.get(`/automations?page=${(pagination?.page || 1) + 1}`);
      setAutomations((prev) => [...prev, ...data.automations]);
      setPagination(data.pagination);
    } finally {
      setLoadingMore(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [realtorId]);

  async function toggleStatus(automation) {
    setBusyId(automation._id);
    const nextStatus = automation.status === 'active' ? 'paused' : 'active';
    try {
      await scoped.patch(`/automations/${automation._id}`, { status: nextStatus });
      load();
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete() {
    await scoped.delete(`/automations/${deleting._id}`);
    setDeleting(null);
    load();
  }

  return (
    <div>
      <PageHeader
        eyebrow="Campaigns"
        title="Automations"
        actions={
          <Link href={`/admin/clients/${realtorId}/automations/new`}>
            <Button>New automation</Button>
          </Link>
        }
      />

      {loadError ? (
        <div className="mb-4 rounded border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">{loadError}</div>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate">Loading…</p>
      ) : automations.length === 0 ? (
        <Card>
          <CardBody className="text-center">
            <p className="text-sm text-slate">
              No automations yet.{' '}
              <Link href={`/admin/clients/${realtorId}/automations/new`} className="font-medium text-verdigris-dark hover:underline">
                Create one
              </Link>{' '}
              to start sending listing digests.
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-3">
          {automations.map((automation) => (
            <Card key={automation._id}>
              <CardBody>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Link
                      href={`/admin/clients/${realtorId}/automations/${automation._id}`}
                      className="font-display text-lg font-semibold text-ink hover:text-verdigris-dark hover:underline"
                    >
                      {automation.name}
                    </Link>
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate">
                      <Badge tone={STATUS_TONE[automation.status]}>{automation.status}</Badge>
                      <span>{describeAudience(automation.audience)}</span>
                      <span>· {describeSchedule(automation.schedule)}</span>
                    </div>
                    <div className="mt-1 text-xs text-slate">
                      {automation.lastRunAt ? `Last ran ${new Date(automation.lastRunAt).toLocaleString()}` : 'Never run'}
                      {automation.nextRunAt ? ` · Next ${new Date(automation.nextRunAt).toLocaleString()}` : ''}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button variant="secondary" onClick={() => toggleStatus(automation)} disabled={busyId === automation._id}>
                      {automation.status === 'active' ? 'Pause' : 'Activate'}
                    </Button>
                    {automation.status !== 'active' ? (
                      <Button variant="ghost" className="text-danger" onClick={() => setDeleting(automation)}>
                        Delete
                      </Button>
                    ) : null}
                    <Link href={`/admin/clients/${realtorId}/automations/${automation._id}`}>
                      <Button variant="ghost">View</Button>
                    </Link>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {pagination && pagination.page < pagination.pages ? (
        <div className="mt-4 flex justify-center">
          <Button variant="secondary" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? 'Loading…' : `Load more (${automations.length} of ${pagination.total})`}
          </Button>
        </div>
      ) : null}

      <ConfirmModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete automation?"
        body={deleting ? `"${deleting.name}" and its settings will be permanently removed. Past run history stays intact for reference.` : ''}
        confirmLabel="Delete"
        onConfirm={handleDelete}
      />
    </div>
  );
}
