'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select, FieldError } from '@/components/ui/Input';
import { ScheduleEditor } from '@/components/ScheduleEditor';
import { AudienceEditor } from '@/components/AudienceEditor';
import { MatchRulesEditor } from '@/components/MatchRulesEditor';
import { EmailTemplateEditor } from '@/components/EmailTemplateEditor';
import { scopedApi } from '@/lib/adminApi';

const STEPS = ['Name & source', 'Audience', 'Match rules', 'Schedule', 'Email template'];

const DEFAULT_MATCH_RULES = {
  bedrooms: 'atLeast',
  bathrooms: 'atLeast',
  familySize: { enabled: true, mode: 'derivedBedrooms', sqftPerPerson: 400 },
  maxPrice: null,
  maxListingsPerBuyer: 8,
  excludePreviouslySent: true,
};

const DEFAULT_EMAIL_TEMPLATE = {
  subject: 'New listings in {{zip}} for you, {{firstName}}',
  introHtml: '',
  ctaLabel: 'View on Zillow',
  theme: { accentColor: '#1a56db' },
};

function StepIndicator({ current }) {
  return (
    <div className="mb-6 flex items-center gap-2 font-mono text-xs uppercase tracking-wide">
      {STEPS.map((label, i) => {
        const stepNum = i + 1;
        const active = stepNum === current;
        const done = stepNum < current;
        return (
          <div key={label} className="flex items-center gap-2">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                active ? 'border-verdigris bg-verdigris text-white' : done ? 'border-verdigris text-verdigris-dark' : 'border-line text-slate'
              }`}
            >
              {stepNum}
            </span>
            <span className={active ? 'text-ink' : 'text-slate'}>{label}</span>
            {stepNum < STEPS.length ? <span className="mx-1 text-slate">—</span> : null}
          </div>
        );
      })}
    </div>
  );
}

export default function NewAutomationWizard({ params }) {
  const { realtorId } = params;
  const scoped = scopedApi(realtorId);
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [automationId, setAutomationId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [spreadsheetConnectionId, setSpreadsheetConnectionId] = useState('');
  const [connections, setConnections] = useState([]);

  const [audience, setAudience] = useState({ type: 'all', value: [] });
  const [buyers, setBuyers] = useState([]);

  const [matchRules, setMatchRules] = useState(DEFAULT_MATCH_RULES);
  const [previewStats, setPreviewStats] = useState(null);
  const [previewing, setPreviewing] = useState(false);

  const [schedule, setSchedule] = useState({ mode: 'manual', cron: null, timezone: null });

  const [emailTemplate, setEmailTemplate] = useState(DEFAULT_EMAIL_TEMPLATE);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewDeliveryId, setPreviewDeliveryId] = useState(null);
  const [renderingPreview, setRenderingPreview] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [testMessage, setTestMessage] = useState('');

  useEffect(() => {
    scoped.get('/spreadsheets').then((data) => setConnections(data.connections)).catch(() => {});
    scoped.get('/buyers?limit=100').then((data) => setBuyers(data.buyers)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realtorId]);

  async function handleStep1Next(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      if (!automationId) {
        const data = await scoped.post('/automations', {
          name,
          spreadsheetConnectionId: spreadsheetConnectionId || null,
          audience: { type: 'all', value: [] },
        });
        setAutomationId(data.automation._id);
      } else {
        await scoped.patch(`/automations/${automationId}`, { name, spreadsheetConnectionId: spreadsheetConnectionId || null });
      }
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleStep2Next() {
    setError('');
    setSaving(true);
    try {
      await scoped.patch(`/automations/${automationId}`, { audience });
      setStep(3);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handlePreviewMatches() {
    setPreviewing(true);
    setError('');
    try {
      await scoped.patch(`/automations/${automationId}`, { matchRules });
      const data = await scoped.post(`/automations/${automationId}/preview`);
      setPreviewStats(data.run.stats);
    } catch (err) {
      setError(err.message);
    } finally {
      setPreviewing(false);
    }
  }

  async function handleStep3Next() {
    setError('');
    setSaving(true);
    try {
      await scoped.patch(`/automations/${automationId}`, { matchRules });
      setStep(4);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleStep4Next() {
    setError('');
    setSaving(true);
    try {
      await scoped.patch(`/automations/${automationId}`, { schedule });
      setStep(5);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleRenderPreview() {
    setRenderingPreview(true);
    setError('');
    try {
      await scoped.patch(`/automations/${automationId}`, { emailTemplate });
      const data = await scoped.post(`/automations/${automationId}/preview`);
      const runDetail = await scoped.get(`/runs/${data.run._id}`);
      const withHtml = runDetail.deliveries.find((d) => d.renderedHtml);
      if (withHtml) {
        const html = await scoped.get(`/deliveries/${withHtml._id}/html`);
        setPreviewHtml(html.html);
        setPreviewDeliveryId(withHtml._id);
      } else {
        setPreviewHtml('');
        setPreviewDeliveryId(null);
        setError('No buyer currently matches this automation, so there is nothing to preview yet.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setRenderingPreview(false);
    }
  }

  async function handleSendTest(e) {
    e.preventDefault();
    setSendingTest(true);
    setTestMessage('');
    try {
      await scoped.post(`/deliveries/${previewDeliveryId}/send-test`, { to: testEmail });
      setTestMessage(`Sent to ${testEmail}.`);
    } catch (err) {
      setTestMessage(err.message);
    } finally {
      setSendingTest(false);
    }
  }

  async function handleFinish(activate) {
    setError('');
    setSaving(true);
    try {
      await scoped.patch(`/automations/${automationId}`, {
        emailTemplate,
        status: activate ? 'active' : 'draft',
      });
      router.push(`/admin/clients/${realtorId}/automations/${automationId}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader eyebrow="New campaign" title="Create an automation" />
      <StepIndicator current={step} />

      <Card>
        <CardBody>
          {step === 1 ? (
            <form onSubmit={handleStep1Next} className="space-y-4">
              <div>
                <Label htmlFor="name">Automation name</Label>
                <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Weekly Bronx Digest" />
              </div>
              <div>
                <Label htmlFor="source">Spreadsheet source (optional)</Label>
                <Select id="source" value={spreadsheetConnectionId} onChange={(e) => setSpreadsheetConnectionId(e.target.value)}>
                  <option value="">No spreadsheet — use manually added buyers</option>
                  {connections.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.sheetUrl}
                    </option>
                  ))}
                </Select>
              </div>
              <FieldError>{error}</FieldError>
              <div className="flex justify-end">
                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving…' : 'Next: Audience'}
                </Button>
              </div>
            </form>
          ) : null}

          {step === 2 ? (
            <div className="space-y-4">
              <AudienceEditor value={audience} onChange={setAudience} buyers={buyers} />
              <FieldError>{error}</FieldError>
              <div className="flex justify-between">
                <Button type="button" variant="secondary" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button type="button" onClick={handleStep2Next} disabled={saving}>
                  {saving ? 'Saving…' : 'Next: Match rules'}
                </Button>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-4">
              <MatchRulesEditor
                value={matchRules}
                onChange={setMatchRules}
                onPreview={handlePreviewMatches}
                previewStats={previewStats}
                previewing={previewing}
              />
              <FieldError>{error}</FieldError>
              <div className="flex justify-between">
                <Button type="button" variant="secondary" onClick={() => setStep(2)}>
                  Back
                </Button>
                <Button type="button" onClick={handleStep3Next} disabled={saving}>
                  {saving ? 'Saving…' : 'Next: Schedule'}
                </Button>
              </div>
            </div>
          ) : null}

          {step === 4 ? (
            <div className="space-y-4">
              <ScheduleEditor value={schedule} onChange={setSchedule} />
              <FieldError>{error}</FieldError>
              <div className="flex justify-between border-t border-line pt-4">
                <Button type="button" variant="secondary" onClick={() => setStep(3)}>
                  Back
                </Button>
                <Button type="button" onClick={handleStep4Next} disabled={saving}>
                  {saving ? 'Saving…' : 'Next: Email template'}
                </Button>
              </div>
            </div>
          ) : null}

          {step === 5 ? (
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <EmailTemplateEditor value={emailTemplate} onChange={setEmailTemplate} />
                <Button type="button" variant="secondary" onClick={handleRenderPreview} disabled={renderingPreview}>
                  {renderingPreview ? 'Rendering…' : 'Refresh preview'}
                </Button>
                <FieldError>{error}</FieldError>
              </div>
              <div>
                <div className="mb-2 text-xs uppercase tracking-wide text-slate">Live preview</div>
                <div className="h-[420px] overflow-hidden rounded border border-line bg-white">
                  {previewHtml ? (
                    <iframe title="Email preview" srcDoc={previewHtml} className="h-full w-full" />
                  ) : (
                    <div className="flex h-full items-center justify-center p-6 text-center text-sm text-slate">
                      Click &ldquo;Refresh preview&rdquo; to see a real rendered email for a matching buyer.
                    </div>
                  )}
                </div>
                {previewDeliveryId ? (
                  <form onSubmit={handleSendTest} className="mt-3 flex gap-2">
                    <Input
                      type="email"
                      required
                      placeholder="you@example.com"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                      className="flex-1"
                    />
                    <Button type="submit" variant="secondary" disabled={sendingTest}>
                      {sendingTest ? 'Sending…' : 'Send test to myself'}
                    </Button>
                  </form>
                ) : null}
                {testMessage ? <p className="mt-1 text-xs text-slate">{testMessage}</p> : null}
              </div>
              <div className="col-span-2 flex justify-between border-t border-line pt-4">
                <Button type="button" variant="secondary" onClick={() => setStep(4)}>
                  Back
                </Button>
                <div className="flex gap-2">
                  <Button type="button" variant="secondary" onClick={() => handleFinish(false)} disabled={saving}>
                    Save as draft
                  </Button>
                  <Button type="button" onClick={() => handleFinish(true)} disabled={saving}>
                    Save & activate
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
}
