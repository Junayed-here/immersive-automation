'use client';

import { useState } from 'react';
import { Label, Input } from '@/components/ui/Input';

export function describeAudience(audience) {
  if (!audience || audience.type === 'all') return 'All active buyers';
  if (audience.type === 'zipList') return `ZIPs: ${audience.value.join(', ') || '—'}`;
  return `${audience.value.length} selected buyer(s)`;
}

/**
 * Controlled editor for Automation.audience ({type, value}). Emits the same
 * shape it's given - callers PATCH it straight through.
 */
export function AudienceEditor({ value, onChange, buyers = [] }) {
  const [zipListInput, setZipListInput] = useState(value?.type === 'zipList' ? value.value.join(', ') : '');

  function setType(type) {
    if (type === 'all') {
      onChange({ type: 'all', value: [] });
    } else if (type === 'zipList') {
      onChange({ type: 'zipList', value: zipListInput.split(',').map((z) => z.trim()).filter(Boolean) });
    } else {
      onChange({ type: 'buyerIds', value: value?.type === 'buyerIds' ? value.value : [] });
    }
  }

  function updateZipList(text) {
    setZipListInput(text);
    onChange({ type: 'zipList', value: text.split(',').map((z) => z.trim()).filter(Boolean) });
  }

  function toggleBuyer(buyerId, checked) {
    const current = value?.type === 'buyerIds' ? value.value : [];
    onChange({ type: 'buyerIds', value: checked ? [...current, buyerId] : current.filter((id) => id !== buyerId) });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {[
          ['all', 'All active buyers'],
          ['zipList', 'Buyers in specific ZIP codes'],
          ['buyerIds', 'Specific buyers'],
        ].map(([type, label]) => (
          <label key={type} className="flex items-center gap-2 text-sm text-ink">
            <input type="radio" name="audienceType" checked={value?.type === type} onChange={() => setType(type)} />
            {label}
          </label>
        ))}
      </div>

      {value?.type === 'zipList' ? (
        <div>
          <Label htmlFor="zips">ZIP codes (comma-separated)</Label>
          <Input id="zips" value={zipListInput} onChange={(e) => updateZipList(e.target.value)} placeholder="10465, 10462" />
        </div>
      ) : null}

      {value?.type === 'buyerIds' ? (
        <div className="max-h-56 overflow-y-auto rounded border border-line">
          {buyers.map((buyer) => (
            <label key={buyer._id} className="flex items-center gap-2 border-b border-line px-3 py-2 text-sm last:border-0">
              <input
                type="checkbox"
                checked={value.value.includes(buyer._id)}
                onChange={(e) => toggleBuyer(buyer._id, e.target.checked)}
              />
              {buyer.name} · {buyer.email}
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}
