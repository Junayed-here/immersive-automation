'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select, FieldError } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { adminApi, scopedApi } from '@/lib/adminApi';
import { ApiError } from '@/lib/api';

const STATUS_TONE = { ok: 'success', partial: 'copper', error: 'danger' };

function toFormValues(realtor) {
  return {
    firstName: realtor.firstName || '',
    lastName: realtor.lastName || '',
    email: realtor.email || '',
    phone: realtor.phone || '',
    licenseNumber: realtor.license?.number || '',
    licenseState: realtor.license?.state || '',
    brokerageName: realtor.brokerage?.name || '',
    brokerageAddress: realtor.brokerage?.address || '',
    brokeragePhone: realtor.brokerage?.phone || '',
    usageLimit: realtor.usageLimit ?? '',
    notificationsEnabled: realtor.notifications?.enabled ?? true,
    status: realtor.status || 'active',
  };
}

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
    usageLimit: form.usageLimit === '' ? null : Number(form.usageLimit),
    notifications: { enabled: form.notificationsEnabled },
    status: form.status,
  };
}

export default function ClientSettingsPage({ params }) {
  const { realtorId } = params;
  const [form, setForm] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [formError, setFormError] = useState('');

  const [sheetUrl, setSheetUrl] = useState('');
  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState('');
  const [previewing, setPreviewing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connections, setConnections] = useState([]);
  const [syncingId, setSyncingId] = useState(null);
  const [errorsOpenId, setErrorsOpenId] = useState(null);

  const scoped = scopedApi(realtorId);

  const loadRealtor = useCallback(() => {
    setLoadError('');
    adminApi
      .get(`/api/admin/clients/${realtorId}`)
      .then((data) => setForm(toFormValues(data.realtor)))
      .catch((err) => setLoadError(err.message || 'Failed to load this client.'));
  }, [realtorId]);

  const loadConnections = useCallback(() => {
    scoped.get('/spreadsheets').then((data) => setConnections(data.connections)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realtorId]);

  useEffect(loadRealtor, [loadRealtor]);
  useEffect(loadConnections, [loadConnections]);

  async function handleSaveProfile(e) {
    e.preventDefault();
    setSaving(true);
    setSaveMessage('');
    setFormError('');
    try {
      await adminApi.patch(`/api/admin/clients/${realtorId}`, toPayload(form));
      setSaveMessage('Saved.');
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  }

  async function handlePreview(e) {
    e.preventDefault();
    setPreviewError('');
    setPreview(null);
    setPreviewing(true);
    try {
      const data = await scoped.post('/spreadsheets/preview', { url: sheetUrl });
      setPreview(data);
    } catch (err) {
      setPreviewError(err instanceof ApiError ? `${err.message}${err.code ? ` (${err.code})` : ''}` : 'Could not preview that sheet.');
    } finally {
      setPreviewing(false);
    }
  }

  async function handleConnect() {
    setConnecting(true);
    try {
      await scoped.post('/spreadsheets/connect', { url: sheetUrl });
      setSheetUrl('');
      setPreview(null);
      loadConnections();
    } catch (err) {
      setPreviewError(err instanceof ApiError ? err.message : 'Could not connect that sheet.');
    } finally {
      setConnecting(false);
    }
  }

  async function handleSync(connection) {
    setSyncingId(connection._id);
    try {
      await scoped.post(`/spreadsheets/${connection._id}/sync`);
      loadConnections();
    } finally {
      setSyncingId(null);
    }
  }

  if (loadError) {
    return <div className="rounded border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">{loadError}</div>;
  }
  if (!form) return <p className="text-sm text-slate">Loading…</p>;

  return (
    <div className="space-y-8">
      <Card>
        <CardBody>
          <h2 className="font-display text-lg font-semibold text-ink">Profile</h2>
          <form onSubmit={handleSaveProfile} className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="firstName">First name</Label>
                <Input id="firstName" required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="lastName">Last name</Label>
                <Input id="lastName" required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
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
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="usageLimit">Usage limit (not enforced yet)</Label>
                <Input
                  id="usageLimit"
                  type="number"
                  min="0"
                  value={form.usageLimit}
                  onChange={(e) => setForm({ ...form, usageLimit: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="status">Status</Label>
                <Select id="status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="pending">Pending</option>
                </Select>
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={form.notificationsEnabled}
                    onChange={(e) => setForm({ ...form, notificationsEnabled: e.target.checked })}
                  />
                  Notifications enabled
                </label>
              </div>
            </div>
            <FieldError>{formError}</FieldError>
            {saveMessage ? <p className="text-sm text-verdigris-dark">{saveMessage}</p> : null}
            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <h2 className="font-display text-lg font-semibold text-ink">Spreadsheet link</h2>
          <p className="mt-1 text-sm text-slate">
            Paste a public Google Sheet link (shared as &ldquo;Anyone with the link&rdquo;). Column headers are recognized
            automatically.
          </p>
          <form onSubmit={handlePreview} className="mt-4 flex gap-2">
            <Input
              placeholder="https://docs.google.com/spreadsheets/d/..."
              value={sheetUrl}
              onChange={(e) => setSheetUrl(e.target.value)}
              required
              className="flex-1"
            />
            <Button type="submit" variant="secondary" disabled={previewing}>
              {previewing ? 'Loading…' : 'Preview'}
            </Button>
          </form>
          <FieldError>{previewError}</FieldError>

          {preview ? (
            <div className="mt-5">
              <div className="mb-2 text-xs uppercase tracking-wide text-slate">Detected columns: {preview.headers.join(', ')}</div>
              <div className="overflow-x-auto rounded border border-line">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-line bg-ink/5">
                      <th className="px-3 py-2 font-medium">Name</th>
                      <th className="px-3 py-2 font-medium">Email</th>
                      <th className="px-3 py-2 font-medium">ZIP(s)</th>
                      <th className="px-3 py-2 font-medium">Beds</th>
                      <th className="px-3 py-2 font-medium">Baths</th>
                      <th className="px-3 py-2 font-medium">Home type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.sampleRows.map((row) => (
                      <tr key={row.email} className="border-b border-line last:border-0">
                        <td className="px-3 py-2">{row.name}</td>
                        <td className="px-3 py-2 font-mono">{row.email}</td>
                        <td className="px-3 py-2 font-mono">{row.zipCodes?.join(', ')}</td>
                        <td className="px-3 py-2">{row.bedrooms ?? '—'}</td>
                        <td className="px-3 py-2">{row.bathrooms ?? '—'}</td>
                        <td className="px-3 py-2">{row.homeType?.join(', ') || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button className="mt-4" onClick={handleConnect} disabled={connecting}>
                {connecting ? 'Connecting…' : 'Connect this sheet'}
              </Button>
            </div>
          ) : null}

          <div className="mt-8">
            <h3 className="font-display text-base font-semibold text-ink">Connected sheets</h3>
            {connections.length === 0 ? (
              <p className="mt-2 text-sm text-slate">No sheets connected yet.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {connections.map((connection) => (
                  <Card key={connection._id}>
                    <CardBody>
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="truncate font-mono text-xs text-slate">{connection.sheetUrl}</div>
                          <div className="mt-2 flex items-center gap-2 text-xs text-slate">
                            {connection.lastSyncStatus ? (
                              <Badge tone={STATUS_TONE[connection.lastSyncStatus] || 'neutral'}>{connection.lastSyncStatus}</Badge>
                            ) : (
                              <Badge tone="neutral">never synced</Badge>
                            )}
                            {connection.lastSyncedAt ? <span>Last synced {new Date(connection.lastSyncedAt).toLocaleString()}</span> : null}
                          </div>
                          {connection.lastSyncStats ? (
                            <div className="mt-2 font-mono text-xs text-slate">
                              {connection.lastSyncStats.created} created · {connection.lastSyncStats.updated} updated ·{' '}
                              {connection.lastSyncStats.archived} archived · {connection.lastSyncStats.duplicates} duplicates ·{' '}
                              {connection.lastSyncStats.errors?.length > 0 ? (
                                <button
                                  className="text-danger underline"
                                  onClick={() => setErrorsOpenId(errorsOpenId === connection._id ? null : connection._id)}
                                >
                                  {connection.lastSyncStats.errors.length} errors
                                </button>
                              ) : (
                                '0 errors'
                              )}
                            </div>
                          ) : null}
                          {errorsOpenId === connection._id && connection.lastSyncStats?.errors?.length > 0 ? (
                            <div className="mt-2 max-h-40 overflow-y-auto rounded border border-line bg-ink/5 p-2 text-xs">
                              {connection.lastSyncStats.errors.map((e, i) => (
                                <div key={i} className="border-b border-line/50 py-1 last:border-0">
                                  <span className="font-mono text-slate">Row {e.row}</span>
                                  {e.email ? <span className="font-mono text-slate"> · {e.email}</span> : null}
                                  <span className="ml-1 text-ink">{e.message}</span>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <Button variant="secondary" onClick={() => handleSync(connection)} disabled={syncingId === connection._id}>
                          {syncingId === connection._id ? 'Syncing…' : 'Sync now'}
                        </Button>
                      </div>
                    </CardBody>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
