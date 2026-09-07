'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input, Label, Select } from '@/components/ui/Input';
import { ScheduleEditor, describeSchedule } from '@/components/ScheduleEditor';
import { AudienceEditor, describeAudience } from '@/components/AudienceEditor';
import { MatchRulesEditor, describeMatchRules } from '@/components/MatchRulesEditor';
import { EmailTemplateEditor, describeEmailTemplate } from '@/components/EmailTemplateEditor';
import { scopedApi } from '@/lib/adminApi';
import { ApiError } from '@/lib/api';

const STATUS_TONE = { active: 'success', paused: 'copper', draft: 'neutral' };
const RUN_STATUS_TONE = { completed: 'success', partial: 'copper', failed: 'danger', running: 'verdigris', queued: 'neutral' };

// Small "Edit" affordance in a stat card's header row - same interaction on
// every card (Schedule, Audience, Match rules, Email template): click, get a
// modal with the matching editor, Save PATCHes just that one field.
function CardEditLink({ onClick }) {
  return (
    <button onClick={onClick} className="text-xs font-medium text-verdigris-dark hover:underline">
      Edit
    </button>
  );
}

export default function AutomationDetailPage({ params }) {
  const { realtorId, automationId } = params;
  const scoped = scopedApi(realtorId);
  const [automation, setAutomation] = useState(null);
  const [runs, setRuns] = useState([]);
  const [buyers, setBuyers] = useState([]);
  const [connections, setConnections] = useState([]);
  const [busy, setBusy] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');

  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [draftSchedule, setDraftSchedule] = useState(null);

  const [audienceModalOpen, setAudienceModalOpen] = useState(false);
  const [draftAudience, setDraftAudience] = useState(null);

  const [matchRulesModalOpen, setMatchRulesModalOpen] = useState(false);
  const [draftMatchRules, setDraftMatchRules] = useState(null);
  const [modalPreviewStats, setModalPreviewStats] = useState(null);
  const [modalPreviewing, setModalPreviewing] = useState(false);

  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [draftTemplate, setDraftTemplate] = useState(null);

  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftConnectionId, setDraftConnectionId] = useState('');

  const [savingField, setSavingField] = useState(false);
  const [modalError, setModalError] = useState('');

  function load() {
    setLoadError('');
    scoped
      .get(`/automations/${automationId}`)
      .then((data) => setAutomation(data.automation))
      .catch((err) => setLoadError(err.message || 'Failed to load this automation.'));
    scoped.get(`/automations/${automationId}/runs`).then((data) => setRuns(data.runs)).catch(() => {});
  }

  useEffect(() => {
    load();
    scoped.get('/buyers?limit=100').then((data) => setBuyers(data.buyers)).catch(() => {});
    scoped.get('/spreadsheets').then((data) => setConnections(data.connections)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [automationId]);

  async function handlePreview() {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const data = await scoped.post(`/automations/${automationId}/preview`);
      setMessage(`Preview complete: ${data.run.stats.buyersMatched} of ${data.run.stats.buyersProcessed} buyer(s) matched, 0 emails sent.`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Preview failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRun() {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const data = await scoped.post(`/automations/${automationId}/run`);
      setMessage(`Run complete: ${data.run.stats.emailsSent} sent, ${data.run.stats.emailsFailed} failed, ${data.run.stats.emailsSkipped} skipped.`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Run failed.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleStatus() {
    setStatusBusy(true);
    try {
      const nextStatus = automation.status === 'active' ? 'paused' : 'active';
      await scoped.patch(`/automations/${automationId}`, { status: nextStatus });
      load();
    } finally {
      setStatusBusy(false);
    }
  }

  async function saveField(patch, { onDone } = {}) {
    setSavingField(true);
    setModalError('');
    try {
      await scoped.patch(`/automations/${automationId}`, patch);
      load();
      if (onDone) onDone();
    } catch (err) {
      setModalError(err instanceof ApiError ? err.message : 'Could not save.');
    } finally {
      setSavingField(false);
    }
  }

  function openScheduleModal() {
    setDraftSchedule(automation.schedule || { mode: 'manual', cron: null, timezone: null });
    setModalError('');
    setScheduleModalOpen(true);
  }

  function openAudienceModal() {
    setDraftAudience(automation.audience);
    setModalError('');
    setAudienceModalOpen(true);
  }

  function openMatchRulesModal() {
    setDraftMatchRules(automation.matchRules);
    setModalPreviewStats(null);
    setModalError('');
    setMatchRulesModalOpen(true);
  }

  async function handleModalPreview() {
    setModalPreviewing(true);
    try {
      await scoped.patch(`/automations/${automationId}`, { matchRules: draftMatchRules });
      const data = await scoped.post(`/automations/${automationId}/preview`);
      setModalPreviewStats(data.run.stats);
    } catch (err) {
      setModalError(err instanceof ApiError ? err.message : 'Preview failed.');
    } finally {
      setModalPreviewing(false);
    }
  }

  function openTemplateModal() {
    setDraftTemplate(automation.emailTemplate);
    setModalError('');
    setTemplateModalOpen(true);
  }

  function openDetailsModal() {
    setDraftName(automation.name);
    setDraftConnectionId(automation.spreadsheetConnectionId || '');
    setModalError('');
    setDetailsModalOpen(true);
  }

  if (loadError && !automation) {
    return <div className="rounded border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">{loadError}</div>;
  }
  if (!automation) return <p className="text-sm text-slate">Loading…</p>;

  return (
    <div>
      <PageHeader
        eyebrow="Automation"
        title={automation.name}
        meta={`Created ${new Date(automation.createdAt).toLocaleDateString()}`}
        actions={
          <>
            <Button variant="ghost" onClick={openDetailsModal}>
              Edit details
            </Button>
            <Button variant="secondary" onClick={handlePreview} disabled={busy}>
              Run preview
            </Button>
            <Button onClick={handleRun} disabled={busy || automation.status !== 'active'}>
              Run now
            </Button>
          </>
        }
      />

      {automation.status !== 'active' ? (
        <p className="mb-4 text-xs text-copper">Only active automations can run for real — activate it below to send.</p>
      ) : null}
      {message ? <p className="mb-4 text-sm text-verdigris-dark">{message}</p> : null}
      {error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <Card>
          <CardBody>
            <div className="flex items-start justify-between gap-2">
              <div className="text-xs uppercase tracking-wide text-slate">Status</div>
            </div>
            <Badge tone={STATUS_TONE[automation.status]}>{automation.status}</Badge>
            <div className="mt-2">
              <Button variant="secondary" onClick={toggleStatus} disabled={statusBusy}>
                {statusBusy ? 'Working…' : automation.status === 'active' ? 'Pause' : 'Activate'}
              </Button>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="flex items-start justify-between gap-2">
              <div className="text-xs uppercase tracking-wide text-slate">Audience</div>
              <CardEditLink onClick={openAudienceModal} />
            </div>
            <div className="mt-1 text-sm text-ink">{describeAudience(automation.audience)}</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="flex items-start justify-between gap-2">
              <div className="text-xs uppercase tracking-wide text-slate">Match rules</div>
              <CardEditLink onClick={openMatchRulesModal} />
            </div>
            <div className="mt-1 text-xs text-ink">{describeMatchRules(automation.matchRules)}</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="flex items-start justify-between gap-2">
              <div className="text-xs uppercase tracking-wide text-slate">Schedule</div>
              <CardEditLink onClick={openScheduleModal} />
            </div>
            <div className="mt-1 text-sm text-ink">{describeSchedule(automation.schedule)}</div>
            {automation.nextRunAt ? (
              <div className="mt-1 text-xs text-slate">Next: {new Date(automation.nextRunAt).toLocaleString()}</div>
            ) : null}
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="flex items-start justify-between gap-2">
              <div className="text-xs uppercase tracking-wide text-slate">Email template</div>
              <CardEditLink onClick={openTemplateModal} />
            </div>
            <div className="mt-1 truncate text-sm text-ink">{describeEmailTemplate(automation.emailTemplate)}</div>
          </CardBody>
        </Card>
      </div>

      <Modal open={scheduleModalOpen} onClose={() => setScheduleModalOpen(false)} title="Edit schedule">
        {draftSchedule ? (
          <div className="space-y-4">
            <ScheduleEditor value={draftSchedule} onChange={setDraftSchedule} />
            {modalError ? <p className="text-sm text-danger">{modalError}</p> : null}
            <div className="flex justify-end gap-2 border-t border-line pt-4">
              <Button type="button" variant="secondary" onClick={() => setScheduleModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => saveField({ schedule: draftSchedule }, { onDone: () => setScheduleModalOpen(false) })}
                disabled={savingField}
              >
                {savingField ? 'Saving…' : 'Save schedule'}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={audienceModalOpen} onClose={() => setAudienceModalOpen(false)} title="Edit audience">
        {draftAudience ? (
          <div className="space-y-4">
            <AudienceEditor value={draftAudience} onChange={setDraftAudience} buyers={buyers} />
            {modalError ? <p className="text-sm text-danger">{modalError}</p> : null}
            <div className="flex justify-end gap-2 border-t border-line pt-4">
              <Button type="button" variant="secondary" onClick={() => setAudienceModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => saveField({ audience: draftAudience }, { onDone: () => setAudienceModalOpen(false) })}
                disabled={savingField}
              >
                {savingField ? 'Saving…' : 'Save audience'}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={matchRulesModalOpen} onClose={() => setMatchRulesModalOpen(false)} title="Edit match rules">
        {draftMatchRules ? (
          <div className="space-y-4">
            <MatchRulesEditor
              value={draftMatchRules}
              onChange={setDraftMatchRules}
              onPreview={handleModalPreview}
              previewStats={modalPreviewStats}
              previewing={modalPreviewing}
              error={modalError}
            />
            <div className="flex justify-end gap-2 border-t border-line pt-4">
              <Button type="button" variant="secondary" onClick={() => setMatchRulesModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => saveField({ matchRules: draftMatchRules }, { onDone: () => setMatchRulesModalOpen(false) })}
                disabled={savingField}
              >
                {savingField ? 'Saving…' : 'Save match rules'}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={templateModalOpen} onClose={() => setTemplateModalOpen(false)} title="Edit email template">
        {draftTemplate ? (
          <div className="space-y-4">
            <EmailTemplateEditor value={draftTemplate} onChange={setDraftTemplate} />
            {modalError ? <p className="text-sm text-danger">{modalError}</p> : null}
            <div className="flex justify-end gap-2 border-t border-line pt-4">
              <Button type="button" variant="secondary" onClick={() => setTemplateModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => saveField({ emailTemplate: draftTemplate }, { onDone: () => setTemplateModalOpen(false) })}
                disabled={savingField}
              >
                {savingField ? 'Saving…' : 'Save template'}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={detailsModalOpen} onClose={() => setDetailsModalOpen(false)} title="Edit details">
        <div className="space-y-4">
          <div>
            <Label htmlFor="detailsName">Automation name</Label>
            <Input id="detailsName" required value={draftName} onChange={(e) => setDraftName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="detailsSource">Spreadsheet source</Label>
            <Select id="detailsSource" value={draftConnectionId} onChange={(e) => setDraftConnectionId(e.target.value)}>
              <option value="">No spreadsheet — use manually added buyers</option>
              {connections.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.sheetUrl}
                </option>
              ))}
            </Select>
          </div>
          {modalError ? <p className="text-sm text-danger">{modalError}</p> : null}
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <Button type="button" variant="secondary" onClick={() => setDetailsModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() =>
                saveField(
                  { name: draftName, spreadsheetConnectionId: draftConnectionId || null },
                  { onDone: () => setDetailsModalOpen(false) }
                )
              }
              disabled={savingField}
            >
              {savingField ? 'Saving…' : 'Save details'}
            </Button>
          </div>
        </div>
      </Modal>

      <div className="mt-8">
        <h2 className="font-display text-lg font-semibold text-ink">Run history</h2>
        <Card className="mt-3">
          {runs.length === 0 ? (
            <CardBody>
              <p className="text-sm text-slate">No runs yet.</p>
            </CardBody>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wide text-slate">
                  <th className="px-5 py-3 font-medium">Trigger</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Sent / Skipped / Failed</th>
                  <th className="px-5 py-3 font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run._id} className="border-b border-line last:border-0">
                    <td className="px-5 py-3 font-mono text-xs">{run.trigger}</td>
                    <td className="px-5 py-3">
                      <Badge tone={RUN_STATUS_TONE[run.status] || 'neutral'}>{run.status}</Badge>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-slate">
                      {run.stats.emailsSent} / {run.stats.emailsSkipped} / {run.stats.emailsFailed}
                    </td>
                    <td className="px-5 py-3">
                      <Link
                        href={`/admin/clients/${realtorId}/automations/${automationId}/runs/${run._id}`}
                        className="text-xs font-medium text-verdigris-dark hover:underline"
                      >
                        {new Date(run.createdAt).toLocaleString()}
                      </Link>
                    </td>
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
