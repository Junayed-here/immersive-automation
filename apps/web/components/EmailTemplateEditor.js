'use client';

import { Label, Input } from '@/components/ui/Input';

export function describeEmailTemplate(template) {
  if (!template?.subject) return 'Default subject line';
  return template.subject;
}

/**
 * Controlled editor for Automation.emailTemplate's fields. The live preview
 * iframe and "send test" flow are page-owned (they involve real API calls -
 * a preview run, a delivery id, an HTML fetch) so they stay outside this
 * component; callers that want them render their own panel alongside this.
 */
export function EmailTemplateEditor({ value, onChange }) {
  function set(patch) {
    onChange({ ...value, ...patch });
  }

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="subject">Subject line</Label>
        <Input id="subject" value={value.subject} onChange={(e) => set({ subject: e.target.value })} />
        <p className="mt-1 text-xs text-slate">Variables: {'{{firstName}}, {{zip}}, {{listingCount}}, {{realtorName}}'}</p>
      </div>
      <div>
        <Label htmlFor="introHtml">Intro message (optional)</Label>
        <Input id="introHtml" value={value.introHtml} onChange={(e) => set({ introHtml: e.target.value })} />
      </div>
      <div>
        <Label htmlFor="ctaLabel">Button label</Label>
        <Input id="ctaLabel" value={value.ctaLabel} onChange={(e) => set({ ctaLabel: e.target.value })} />
        <p className="mt-1 text-xs text-slate">Links straight to the listing&apos;s Zillow page.</p>
      </div>
      <div>
        <Label htmlFor="accentColor">Accent color</Label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={value.theme.accentColor}
            onChange={(e) => set({ theme: { ...value.theme, accentColor: e.target.value } })}
            className="h-9 w-12 rounded border border-line"
          />
          <Input value={value.theme.accentColor} onChange={(e) => set({ theme: { ...value.theme, accentColor: e.target.value } })} />
        </div>
      </div>
    </div>
  );
}
