'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FieldError } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';
import { TimeSeriesChart } from '@/components/charts/TimeSeriesChart';
import { BreakdownBarChart } from '@/components/charts/BreakdownBarChart';
import { DeliveryHistoryAccordion } from '@/components/DeliveryHistoryAccordion';
import { BuyerFieldsForm, buyerToFormValues, buyerFormToPayload } from '@/components/BuyerFieldsForm';
import { scopedApi } from '@/lib/adminApi';
import { ApiError } from '@/lib/api';

const SKIP_REASON_LABEL = { no_matches: 'No matches', unsubscribed: 'Unsubscribed', cap_reached: 'Cap reached' };
const TABS = ['overview', 'settings'];

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

export default function BuyerDetailPage({ params }) {
  const { realtorId, buyerId } = params;
  const scoped = scopedApi(realtorId);
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = TABS.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'overview';

  const [buyer, setBuyer] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [deliveries, setDeliveries] = useState([]);

  const [form, setForm] = useState(null);
  const [subscribed, setSubscribed] = useState(true);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [loadError, setLoadError] = useState('');

  function loadBuyer() {
    return scoped
      .get(`/buyers/${buyerId}`)
      .then((data) => {
        setBuyer(data.buyer);
        setForm(buyerToFormValues(data.buyer));
        setSubscribed(data.buyer.subscribed);
      })
      .catch((err) => setLoadError(err.message || 'Failed to load this buyer.'));
  }

  useEffect(() => {
    setLoadError('');
    loadBuyer();
    scoped
      .get(`/buyers/${buyerId}/analytics`)
      .then(setAnalytics)
      .catch((err) => setLoadError((prev) => prev || err.message || 'Failed to load this buyer’s analytics.'));
    scoped
      .get(`/buyers/${buyerId}/deliveries`)
      .then((data) => setDeliveries(data.deliveries))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buyerId]);

  function setTab(next) {
    const params2 = new URLSearchParams(searchParams.toString());
    params2.set('tab', next);
    router.replace(`?${params2.toString()}`, { scroll: false });
  }

  async function handleSaveSettings(e) {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    setFieldErrors({});
    setSaveMessage('');
    try {
      await scoped.patch(`/buyers/${buyerId}`, { ...buyerFormToPayload(form), subscribed });
      setSaveMessage('Saved.');
      loadBuyer();
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
        if (err.details) setFieldErrors(Object.fromEntries(err.details.map((d) => [d.field, d.message])));
      }
    } finally {
      setSaving(false);
    }
  }

  if (loadError && (!buyer || !analytics || !form)) {
    return <div className="rounded border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">{loadError}</div>;
  }
  if (!buyer || !analytics || !form) return <p className="text-sm text-slate">Loading…</p>;

  const skipReasonData = Object.entries(analytics.skipReasons)
    .filter(([, value]) => value > 0)
    .map(([key, value]) => ({ label: SKIP_REASON_LABEL[key] || key, value }));

  return (
    <div>
      <PageHeader
        eyebrow={
          <Link href={`/admin/clients/${realtorId}/buyers`} className="hover:underline">
            ← Back to buyers
          </Link>
        }
        title={buyer.name}
        meta={buyer.email}
      />

      <div className="mb-6 flex gap-1 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium capitalize ${
              tab === t ? 'border-verdigris text-verdigris-dark' : 'border-transparent text-slate hover:text-ink'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'overview' ? (
        <div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard label="Listings sent" value={analytics.totals.sent} />
            <StatCard label="Total listings received" value={analytics.totals.totalListingsReceived} />
            <StatCard label="Skipped" value={analytics.totals.skipped} hint={analytics.totals.failed ? `${analytics.totals.failed} failed` : undefined} />
            <StatCard
              label="Last emailed"
              value={analytics.lastDeliveryAt ? new Date(analytics.lastDeliveryAt).toLocaleDateString() : '—'}
            />
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardBody>
                <h2 className="font-display text-base font-semibold text-ink">Activity, last 30 days</h2>
                <div className="mt-3">
                  <TimeSeriesChart
                    data={analytics.sentOverTime}
                    series={[
                      { key: 'sent', label: 'Sent', color: '#3E6E63' },
                      { key: 'skipped', label: 'Skipped', color: '#B9713D' },
                      { key: 'failed', label: 'Failed', color: '#A6432F' },
                    ]}
                  />
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <h2 className="font-display text-base font-semibold text-ink">Skip reasons</h2>
                <div className="mt-3">
                  <BreakdownBarChart data={skipReasonData} color="#B9713D" />
                </div>
              </CardBody>
            </Card>
          </div>

          <div className="mt-8">
            <h2 className="font-display text-lg font-semibold text-ink">Send history</h2>
            <Card className="mt-3">
              <DeliveryHistoryAccordion deliveries={deliveries} />
            </Card>
          </div>
        </div>
      ) : (
        <Card>
          <CardBody>
            <form onSubmit={handleSaveSettings} className="max-w-xl space-y-4">
              <div className="flex items-center justify-between rounded border border-line p-3">
                <div>
                  <div className="text-sm font-medium text-ink">Receiving listing emails</div>
                  <div className="text-xs text-slate">Turn off to pause automations for this buyer without archiving them.</div>
                </div>
                <Switch checked={subscribed} onChange={setSubscribed} label="Active" />
              </div>

              <BuyerFieldsForm form={form} setForm={setForm} fieldErrors={fieldErrors} />

              <FieldError>{formError}</FieldError>
              <div className="flex items-center gap-3 border-t border-line pt-4">
                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving…' : 'Save changes'}
                </Button>
                {saveMessage ? <span className="text-sm text-slate">{saveMessage}</span> : null}
              </div>
            </form>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
