'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Label, FieldError } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { TimeSeriesChart } from '@/components/charts/TimeSeriesChart';
import { BreakdownBarChart } from '@/components/charts/BreakdownBarChart';
import { adminApi } from '@/lib/adminApi';
import { ApiError } from '@/lib/api';

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

const EMPTY_FORM = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  licenseNumber: '',
  licenseState: '',
  brokerageName: '',
  brokerageAddress: '',
  brokeragePhone: '',
  sheetUrl: '',
};

function toPayload(form) {
  return {
    firstName: form.firstName,
    lastName: form.lastName,
    email: form.email,
    phone: form.phone || undefined,
    license: { number: form.licenseNumber || undefined, state: form.licenseState || undefined },
    brokerage: {
      name: form.brokerageName || undefined,
      address: form.brokerageAddress || undefined,
      phone: form.brokeragePhone || undefined,
    },
    sheetUrl: form.sheetUrl || undefined,
  };
}

export default function ClientsListPage() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pagination, setPagination] = useState(null);
  const [search, setSearch] = useState('');
  const [overview, setOverview] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadClients = useCallback(() => {
    setLoading(true);
    setLoadError('');
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    adminApi
      .get(`/api/admin/clients?${params.toString()}`)
      .then((data) => {
        setClients(data.realtors);
        setPagination(data.pagination);
      })
      .catch((err) => setLoadError(err.message || 'Failed to load clients.'))
      .finally(() => setLoading(false));
  }, [search]);

  async function loadMoreClients() {
    setLoadingMore(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    params.set('page', String((pagination?.page || 1) + 1));
    try {
      const data = await adminApi.get(`/api/admin/clients?${params.toString()}`);
      setClients((prev) => [...prev, ...data.realtors]);
      setPagination(data.pagination);
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(loadClients, 200);
    return () => clearTimeout(timeout);
  }, [loadClients]);

  useEffect(() => {
    adminApi
      .get('/api/admin/overview')
      .then(setOverview)
      .catch((err) => setLoadError((prev) => prev || err.message || 'Failed to load the overview stats.'));
  }, []);

  function openAddModal() {
    setForm(EMPTY_FORM);
    setFieldErrors({});
    setFormError('');
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setFormError('');
    setFieldErrors({});
    try {
      await adminApi.post('/api/admin/clients', toPayload(form));
      setModalOpen(false);
      loadClients();
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
        if (err.details) setFieldErrors(Object.fromEntries(err.details.map((d) => [d.field, d.message])));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader eyebrow="Admin" title="Clients" actions={<Button onClick={openAddModal}>Onboard client</Button>} />

      {loadError ? (
        <div className="mb-4 rounded border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">{loadError}</div>
      ) : null}

      {overview ? (
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="Active clients" value={overview.realtors.active} />
          <StatCard label="Active buyers" value={overview.buyers.active} />
          <StatCard label="Automations" value={overview.automations.active} hint={`${overview.automations.total} total`} />
          <StatCard label="Emails sent" value={overview.runs.emailsSent} hint="All-time, all clients" />
        </div>
      ) : null}

      {overview ? (
        <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardBody>
              <h2 className="font-display text-base font-semibold text-ink">Emails, last 30 days — all clients</h2>
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
          <Card>
            <CardBody>
              <h2 className="font-display text-base font-semibold text-ink">By client</h2>
              <div className="mt-3">
                <BreakdownBarChart data={overview.byRealtor.map((r) => ({ label: r.name, value: r.emailsSent }))} color="#3E6E63" />
              </div>
            </CardBody>
          </Card>
        </div>
      ) : null}

      {overview && (overview.needsAttention.failingAutomations.length > 0 || overview.needsAttention.erroredSheets.length > 0) ? (
        <Card className="mb-6 border-danger/30 bg-danger/5">
          <CardBody>
            <div className="text-xs font-medium uppercase tracking-wide text-danger">Needs attention</div>
            <ul className="mt-2 space-y-1 text-sm text-ink">
              {overview.needsAttention.failingAutomations.map((a) => (
                <li key={a._id}>
                  <Link href={`/admin/clients/${a.realtorId?._id}/automations/${a._id}`} className="hover:underline">
                    {a.realtorId?.firstName} {a.realtorId?.lastName} — &ldquo;{a.name}&rdquo;
                  </Link>{' '}
                  had a failed or partial run last time it ran.
                </li>
              ))}
              {overview.needsAttention.erroredSheets.map((s) => (
                <li key={s._id}>
                  <Link href={`/admin/clients/${s.realtorId?._id}/settings`} className="hover:underline">
                    {s.realtorId?.firstName} {s.realtorId?.lastName}
                  </Link>
                  &rsquo;s spreadsheet sync last errored.
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      <div className="mb-4">
        <Input
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
      </div>

      <Card>
        {loading ? (
          <div className="p-5 text-sm text-slate">Loading…</div>
        ) : clients.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate">No clients yet. Onboard your first realtor to get started.</div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wide text-slate">
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Email</th>
                <th className="px-5 py-3 font-medium">Brokerage</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client._id} className="border-b border-line last:border-0">
                  <td className="px-5 py-3 font-medium text-ink">
                    <Link href={`/admin/clients/${client._id}`} className="hover:text-verdigris-dark hover:underline">
                      {client.fullName}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-slate">{client.email}</td>
                  <td className="px-5 py-3 text-slate">{client.brokerage?.name || '—'}</td>
                  <td className="px-5 py-3">
                    <Badge tone={client.status === 'active' ? 'success' : 'neutral'}>{client.status}</Badge>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link href={`/admin/clients/${client._id}`} className="text-xs font-medium text-verdigris-dark hover:underline">
                      Manage
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </Card>

      {pagination && pagination.page < pagination.pages ? (
        <div className="mt-4 flex justify-center">
          <Button variant="secondary" onClick={loadMoreClients} disabled={loadingMore}>
            {loadingMore ? 'Loading…' : `Load more (${clients.length} of ${pagination.total})`}
          </Button>
        </div>
      ) : null}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Onboard a new client">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="firstName">First name</Label>
              <Input id="firstName" required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
              <FieldError>{fieldErrors.firstName}</FieldError>
            </div>
            <div>
              <Label htmlFor="lastName">Last name</Label>
              <Input id="lastName" required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
              <FieldError>{fieldErrors.lastName}</FieldError>
            </div>
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <FieldError>{fieldErrors.email}</FieldError>
          </div>
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="licenseNumber">License number</Label>
              <Input id="licenseNumber" value={form.licenseNumber} onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="licenseState">License state</Label>
              <Input id="licenseState" value={form.licenseState} onChange={(e) => setForm({ ...form, licenseState: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="brokerageName">Brokerage name</Label>
              <Input id="brokerageName" value={form.brokerageName} onChange={(e) => setForm({ ...form, brokerageName: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="brokeragePhone">Brokerage phone</Label>
              <Input id="brokeragePhone" value={form.brokeragePhone} onChange={(e) => setForm({ ...form, brokeragePhone: e.target.value })} />
            </div>
          </div>
          <div>
            <Label htmlFor="brokerageAddress">Brokerage address</Label>
            <Input id="brokerageAddress" value={form.brokerageAddress} onChange={(e) => setForm({ ...form, brokerageAddress: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="sheetUrl">Spreadsheet link (optional)</Label>
            <Input
              id="sheetUrl"
              placeholder="https://docs.google.com/spreadsheets/d/..."
              value={form.sheetUrl}
              onChange={(e) => setForm({ ...form, sheetUrl: e.target.value })}
            />
          </div>
          <FieldError>{formError}</FieldError>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Onboarding…' : 'Onboard client'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
