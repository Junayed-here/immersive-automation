'use client';

import { Label, Input, Select, FieldError } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

const BED_BATH_LABEL = { exact: 'exactly', atLeast: 'at least', atLeastMinusOne: 'at least one fewer than' };

export function describeMatchRules(matchRules) {
  const parts = [
    `${BED_BATH_LABEL[matchRules.bedrooms] || matchRules.bedrooms} the buyer's preferred bedrooms`,
    `${BED_BATH_LABEL[matchRules.bathrooms] || matchRules.bathrooms} preferred bathrooms`,
    `up to ${matchRules.maxListingsPerBuyer} listing(s) per email`,
  ];
  if (matchRules.maxPrice) parts.push(`capped at $${matchRules.maxPrice.toLocaleString()}`);
  return parts.join(' · ');
}

/**
 * Controlled editor for Automation.matchRules. `onPreview`/`previewStats`/
 * `previewing` are optional - when given, renders the "Preview matches" action.
 */
export function MatchRulesEditor({ value, onChange, onPreview, previewStats, previewing, error }) {
  function set(patch) {
    onChange({ ...value, ...patch });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="bedroomsMode">Bedroom matching</Label>
          <Select id="bedroomsMode" value={value.bedrooms} onChange={(e) => set({ bedrooms: e.target.value })}>
            <option value="atLeast">At least the buyer&apos;s preferred bedrooms</option>
            <option value="exact">Exactly the buyer&apos;s preferred bedrooms</option>
            <option value="atLeastMinusOne">At least one fewer than preferred</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="bathroomsMode">Bathroom matching</Label>
          <Select id="bathroomsMode" value={value.bathrooms} onChange={(e) => set({ bathrooms: e.target.value })}>
            <option value="atLeast">At least the buyer&apos;s preferred bathrooms</option>
            <option value="exact">Exactly the buyer&apos;s preferred bathrooms</option>
            <option value="atLeastMinusOne">At least one fewer than preferred</option>
          </Select>
        </div>
      </div>

      <p className="text-xs text-slate">
        Bedrooms/bathrooms/basement/home type/parking/min sqft/min year built/buy-or-rent are only applied when a
        buyer has that preference set — a buyer with none of them set receives every listing in their ZIP(s).
      </p>

      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={value.familySize.enabled}
          onChange={(e) => set({ familySize: { ...value.familySize, enabled: e.target.checked } })}
        />
        Also factor in family size
      </label>

      {value.familySize.enabled ? (
        <div className="grid grid-cols-2 gap-3 pl-6">
          <div>
            <Label htmlFor="familySizeMode">Method</Label>
            <Select
              id="familySizeMode"
              value={value.familySize.mode}
              onChange={(e) => set({ familySize: { ...value.familySize, mode: e.target.value } })}
            >
              <option value="derivedBedrooms">Derive required bedrooms</option>
              <option value="minSqft">Minimum square footage</option>
            </Select>
          </div>
          {value.familySize.mode === 'minSqft' ? (
            <div>
              <Label htmlFor="sqftPerPerson">Sqft per person</Label>
              <Input
                id="sqftPerPerson"
                type="number"
                value={value.familySize.sqftPerPerson}
                onChange={(e) => set({ familySize: { ...value.familySize, sqftPerPerson: Number(e.target.value) || 400 } })}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="maxPrice">Max price (optional)</Label>
          <Input
            id="maxPrice"
            type="number"
            value={value.maxPrice ?? ''}
            onChange={(e) => set({ maxPrice: e.target.value === '' ? null : Number(e.target.value) })}
          />
        </div>
        <div>
          <Label htmlFor="maxListingsPerBuyer">Max listings per email</Label>
          <Input
            id="maxListingsPerBuyer"
            type="number"
            min="1"
            value={value.maxListingsPerBuyer}
            onChange={(e) => set({ maxListingsPerBuyer: Number(e.target.value) || 8 })}
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={value.excludePreviouslySent}
          onChange={(e) => set({ excludePreviouslySent: e.target.checked })}
        />
        Don&apos;t re-send listings a buyer already received
      </label>

      {onPreview ? (
        <div className="flex items-center gap-3 border-t border-line pt-4">
          <Button type="button" variant="secondary" onClick={onPreview} disabled={previewing}>
            {previewing ? 'Checking…' : 'Preview matches'}
          </Button>
          {previewStats ? (
            <span className="font-mono text-sm text-verdigris-dark">
              Matches {previewStats.buyersMatched} of {previewStats.buyersProcessed} buyer(s)
            </span>
          ) : null}
        </div>
      ) : null}

      <FieldError>{error}</FieldError>
    </div>
  );
}
