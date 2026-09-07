'use client';

import { Fragment, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, FieldError } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Switch } from '@/components/ui/Switch';
import { ChevronIcon, GearIcon } from '@/components/ui/icons';
import { BuyerFieldsForm, EMPTY_BUYER_FORM, buyerFormToPayload } from '@/components/BuyerFieldsForm';
import { scopedApi } from '@/lib/adminApi';
import { ApiError } from '@/lib/api';

const HOME_TYPE_LABEL = (t) => t.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

function BuyerDetailsRow({ buyer, realtorId }) {
  const p = buyer.preferences || {};
  return (
    <tr className="border-b border-line bg-paper/40 last:border-0">
      <td colSpan={7} className="px-5 py-3">
        <div className="flex items-start justify-between gap-4">
          <dl className="grid flex-1 grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate sm:grid-cols-4">
            <div>
              <dt className="uppercase tracking-wide">Family size</dt>
              <dd className="text-ink">{p.familySize ?? '—'}</dd>
            </div>
            <div>
              <dt className="uppercase tracking-wide">Basement</dt>
              <dd className="text-ink">{p.basement === undefined ? 'No preference' : p.basement ? 'Yes' : 'No'}</dd>
            </div>
            <div>
              <dt className="uppercase tracking-wide">Parking</dt>
              <dd className="text-ink">{p.parking === undefined ? 'No preference' : p.parking ? 'Yes' : 'No'}</dd>
            </div>
            <div>
              <dt className="uppercase tracking-wide">Buy / rent</dt>
              <dd className="text-ink capitalize">{p.listingType || 'buy'}</dd>
            </div>
            <div>
              <dt className="uppercase tracking-wide">Home type(s)</dt>
              <dd className="text-ink">{p.homeType?.length ? p.homeType.map(HOME_TYPE_LABEL).join(', ') : '—'}</dd>
            </div>
            <div>
              <dt className="uppercase tracking-wide">Min sqft</dt>
              <dd className="text-ink">{p.minSqft ?? '—'}</dd>
            </div>
            <div>
              <dt className="uppercase tracking-wide">Min year built</dt>
              <dd className="text-ink">{p.minYearBuilt ?? '—'}</dd>
            </div>
          </dl>
          <Link
            href={`/admin/clients/${realtorId}/buyers/${buyer._id}?tab=settings`}
            title="Buyer settings"
            className="mt-0.5 shrink-0 text-slate hover:text-verdigris-dark"
          >
            <GearIcon className="h-4 w-4" />
          </Link>
        </div>
      </td>
    </tr>
  );
}

export default function BuyersPage({ params }) {
  const { realtorId } = params;
  const scoped = scopedApi(realtorId);

  const [buyers, setBuyers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [pagination, setPagination] = useState(null);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [togglingId, setTogglingId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_BUYER_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [archiving, setArchiving] = useState(null);

  const loadBuyers = useCallback(() => {
    setLoading(true);
    setLoadError('');
    const params2 = new URLSearchParams();
    if (search) params2.set('search', search);
    if (showArchived) params2.set('status', 'all');
    scoped
      .get(`/buyers?${params2.toString()}`)
      .then((data) => {
        setBuyers(data.buyers);
        setPagination(data.pagination);
      })
      .catch((err) => setLoadError(err.message || 'Failed to load buyers.'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, showArchived, realtorId]);

  async function loadMoreBuyers() {
    setLoadingMore(true);
    const params2 = new URLSearchParams();
    if (search) params2.set('search', search);
    if (showArchived) params2.set('status', 'all');
    params2.set('page', String((pagination?.page || 1) + 1));
    try {
      const data = await scoped.get(`/buyers?${params2.toString()}`);
      setBuyers((prev) => [...prev, ...data.buyers]);
      setPagination(data.pagination);
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(loadBuyers, 200);
    return () => clearTimeout(timeout);
  }, [loadBuyers]);

  function openAddModal() {
    setForm(EMPTY_BUYER_FORM);
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
      await scoped.post('/buyers', buyerFormToPayload(form));
      setModalOpen(false);
      loadBuyers();
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
        if (err.details) setFieldErrors(Object.fromEntries(err.details.map((d) => [d.field, d.message])));
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleArchive() {
    await scoped.delete(`/buyers/${archiving._id}`);
    setArchiving(null);
    loadBuyers();
  }

  async function toggleSubscribed(buyer, next) {
    setTogglingId(buyer._id);
    setBuyers((prev) => prev.map((b) => (b._id === buyer._id ? { ...b, subscribed: next } : b)));
    try {
      await scoped.patch(`/buyers/${buyer._id}`, { subscribed: next });
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div>
      <PageHeader eyebrow="Buyer list" title="Buyers" actions={<Button onClick={openAddModal}>Add buyer</Button>} />

      {loadError ? (
        <div className="mb-4 rounded border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">{loadError}</div>
      ) : null}

      <div className="mb-4 flex items-center gap-3">
        <Input placeholder="Search by name or email…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <label className="flex items-center gap-2 text-sm text-slate">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          Show archived
        </label>
      </div>

      <Card>
        {loading ? (
          <div className="p-5 text-sm text-slate">Loading…</div>
        ) : buyers.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate">No buyers yet. Add one manually, or connect a spreadsheet from Settings.</div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wide text-slate">
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Email</th>
                <th className="px-5 py-3 font-medium">ZIP(s)</th>
                <th className="px-5 py-3 font-medium">Beds / Baths</th>
                <th className="px-5 py-3 font-medium">Sent</th>
                <th className="px-5 py-3 font-medium">Active</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {buyers.map((buyer) => (
                <Fragment key={buyer._id}>
                  <tr className="border-b border-line last:border-0">
                    <td className="px-5 py-3 font-medium text-ink">
                      <Link href={`/admin/clients/${realtorId}/buyers/${buyer._id}`} className="hover:text-verdigris-dark hover:underline">
                        {buyer.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-slate">{buyer.email}</td>
                    <td className="px-5 py-3 font-mono text-xs">{buyer.preferences?.zipCodes?.join(', ') || '—'}</td>
                    <td className="px-5 py-3 font-mono text-xs text-slate">
                      {buyer.preferences?.bedrooms ?? '—'} bd / {buyer.preferences?.bathrooms ?? '—'} ba
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-slate">{buyer.sentListingsCount ?? 0}</td>
                    <td className="px-5 py-3">
                      <Switch
                        checked={buyer.subscribed}
                        disabled={togglingId === buyer._id}
                        onChange={(next) => toggleSubscribed(buyer, next)}
                        label={`${buyer.name} active`}
                      />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        {buyer.status === 'active' ? (
                          <button onClick={() => setArchiving(buyer)} className="text-xs font-medium text-danger hover:underline">
                            Archive
                          </button>
                        ) : (
                          <Badge tone="neutral">archived</Badge>
                        )}
                        <button
                          onClick={() => setExpandedId(expandedId === buyer._id ? null : buyer._id)}
                          aria-label="Toggle filter details"
                          className="text-slate hover:text-ink"
                        >
                          <ChevronIcon open={expandedId === buyer._id} className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedId === buyer._id ? <BuyerDetailsRow buyer={buyer} realtorId={realtorId} /> : null}
                </Fragment>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </Card>

      {pagination && pagination.page < pagination.pages ? (
        <div className="mt-4 flex justify-center">
          <Button variant="secondary" onClick={loadMoreBuyers} disabled={loadingMore}>
            {loadingMore ? 'Loading…' : `Load more (${buyers.length} of ${pagination.total})`}
          </Button>
        </div>
      ) : null}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add buyer">
        <form onSubmit={handleSubmit} className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
          <BuyerFieldsForm form={form} setForm={setForm} fieldErrors={fieldErrors} />
          <FieldError>{formError}</FieldError>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : 'Add buyer'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={!!archiving}
        onClose={() => setArchiving(null)}
        title="Archive buyer?"
        body={archiving ? `${archiving.name} will stop receiving automation emails. They stay in the buyer list as archived.` : ''}
        confirmLabel="Archive"
        onConfirm={handleArchive}
      />
    </div>
  );
}
