'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { TimeSeriesChart } from '@/components/charts/TimeSeriesChart';
import { BreakdownBarChart } from '@/components/charts/BreakdownBarChart';
import { scopedApi } from '@/lib/adminApi';

const RUN_STATUS_TONE = { completed: 'success', partial: 'copper', failed: 'danger', running: 'verdigris', queued: 'neutral' };

function StatCard({ label, value, hint }) {
  return (
    <Card>
      <CardBody>
        <div className="font-mono text-xs uppercase tracking-widest text-slate">{label}</div>
        <div className="mt-2 font-mono text-3xl font-semibold text-ink">{value}</div>
        {hint ? <div className="mt-1 text-xs text-slate">{hint}</div> : null}
      </CardBody>
    </Card>
  );
}

export default function ClientOverviewPage({ params }) {
  const { realtorId } = params;
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    scopedApi(realtorId)
      .get('/overview')
      .then(setOverview)
      .catch((err) => setError(err.message || 'Failed to load this client’s overview.'))
      .finally(() => setLoading(false));
  }, [realtorId]);

  if (error) {
    return <div className="rounded border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">{error}</div>;
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Active buyers" value={loading ? '—' : overview.buyers.active} hint={loading ? undefined : `${overview.buyers.archived} archived`} />
        <StatCard
          label="Automations"
          value={loading ? '—' : overview.automations.active}
          hint={loading ? undefined : `${overview.automations.total} total`}
        />
        <StatCard label="Emails sent" value={loading ? '—' : overview.runs.emailsSent} hint="All-time" />
        <StatCard
          label="Last run"
          value={loading || !overview.runs.lastRunAt ? '—' : new Date(overview.runs.lastRunAt).toLocaleDateString()}
        />
      </div>

      {!loading ? (
        <div className="mt-8 space-y-4">
          <Card>
            <CardBody>
              <h2 className="font-display text-base font-semibold text-ink">Emails, last 30 days</h2>
              <div className="mt-3">
                <TimeSeriesChart
                  data={overview.runs.sentOverTime}
                  series={[
                    { key: 'emailsSent', label: 'Sent', color: '#3E6E63' },
                    { key: 'emailsSkipped', label: 'Skipped', color: '#B9713D' },
                    { key: 'emailsFailed', label: 'Failed', color: '#A6432F' },
                  ]}
                />
              </div>
            </CardBody>
          </Card>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardBody>
                <h2 className="font-display text-base font-semibold text-ink">By automation</h2>
                <div className="mt-3">
                  <BreakdownBarChart
                    data={overview.automations.breakdown.map((a) => ({ label: a.name, value: a.emailsSent }))}
                    color="#3E6E63"
                  />
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <h2 className="font-display text-base font-semibold text-ink">Buyer list growth</h2>
                <div className="mt-3">
                  <TimeSeriesChart data={overview.buyers.growthOverTime} series={[{ key: 'buyers', label: 'Buyers', color: '#2C5049' }]} />
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      ) : null}

      <div className="mt-8">
        <h2 className="font-display text-lg font-semibold text-ink">Recent runs</h2>
        <Card className="mt-3">
          {loading ? (
            <div className="p-5 text-sm text-slate">Loading…</div>
          ) : overview.runs.recent.length === 0 ? (
            <CardBody>
              <p className="text-sm text-slate">
                No automation has run yet.{' '}
                <Link href={`/admin/clients/${realtorId}/automations/new`} className="font-medium text-verdigris-dark hover:underline">
                  Create one
                </Link>{' '}
                to get started.
              </p>
            </CardBody>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wide text-slate">
                  <th className="px-5 py-3 font-medium">Automation</th>
                  <th className="px-5 py-3 font-medium">Trigger</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Sent / Skipped / Failed</th>
                  <th className="px-5 py-3 font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {overview.runs.recent.map((run) => (
                  <tr key={run._id} className="border-b border-line last:border-0">
                    <td className="px-5 py-3">
                      <Link
                        href={`/admin/clients/${realtorId}/automations/${run.automationId?._id}`}
                        className="font-medium text-ink hover:text-verdigris-dark hover:underline"
                      >
                        {run.automationId?.name || 'Deleted automation'}
                      </Link>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-slate">{run.trigger}</td>
                    <td className="px-5 py-3">
                      <Badge tone={RUN_STATUS_TONE[run.status] || 'neutral'}>{run.status}</Badge>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-slate">
                      {run.stats?.emailsSent ?? 0} / {run.stats?.emailsSkipped ?? 0} / {run.stats?.emailsFailed ?? 0}
                    </td>
                    <td className="px-5 py-3 text-xs text-slate">{new Date(run.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
