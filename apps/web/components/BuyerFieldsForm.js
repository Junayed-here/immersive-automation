'use client';

import { Input, Label, Select, FieldError } from '@/components/ui/Input';

export const EMPTY_BUYER_FORM = {
  name: '',
  email: '',
  phone: '',
  zip: '',
  bedrooms: '',
  bathrooms: '',
  familySize: '',
  basement: '',
  homeType: '',
  parking: '',
  minSqft: '',
  minYearBuilt: '',
  listingType: 'buy',
};

const TRI_STATE_OPTIONS = [
  ['', 'No preference'],
  ['true', 'Yes'],
  ['false', 'No'],
];

export function buyerToFormValues(buyer) {
  const p = buyer.preferences || {};
  return {
    name: buyer.name || '',
    email: buyer.email || '',
    phone: buyer.phone || '',
    zip: p.zipCodes?.join(', ') || '',
    bedrooms: p.bedrooms ?? '',
    bathrooms: p.bathrooms ?? '',
    familySize: p.familySize ?? '',
    basement: p.basement === undefined ? '' : String(p.basement),
    homeType: p.homeType?.join(', ') || '',
    parking: p.parking === undefined ? '' : String(p.parking),
    minSqft: p.minSqft ?? '',
    minYearBuilt: p.minYearBuilt ?? '',
    listingType: p.listingType || 'buy',
  };
}

export function buyerFormToPayload(form) {
  return {
    name: form.name,
    email: form.email,
    phone: form.phone || undefined,
    preferences: {
      zipCodes: form.zip ? form.zip.split(',').map((z) => z.trim()).filter(Boolean) : [],
      bedrooms: form.bedrooms === '' ? undefined : Number(form.bedrooms),
      bathrooms: form.bathrooms === '' ? undefined : Number(form.bathrooms),
      familySize: form.familySize === '' ? undefined : Number(form.familySize),
      basement: form.basement === '' ? undefined : form.basement === 'true',
      homeType: form.homeType
        ? form.homeType.split(',').map((t) => t.trim().toUpperCase().replace(/[\s-]+/g, '_')).filter(Boolean)
        : [],
      parking: form.parking === '' ? undefined : form.parking === 'true',
      minSqft: form.minSqft === '' ? undefined : Number(form.minSqft),
      minYearBuilt: form.minYearBuilt === '' ? undefined : Number(form.minYearBuilt),
      listingType: form.listingType,
    },
  };
}

/**
 * Controlled name/email/phone + preferences field set shared by the buyer
 * list's "Add buyer" modal and the buyer detail page's Settings tab.
 */
export function BuyerFieldsForm({ form, setForm, fieldErrors = {} }) {
  function set(patch) {
    setForm({ ...form, ...patch });
  }

  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="name">Name</Label>
        <Input id="name" required value={form.name} onChange={(e) => set({ name: e.target.value })} />
        <FieldError>{fieldErrors.name}</FieldError>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required value={form.email} onChange={(e) => set({ email: e.target.value })} />
          <FieldError>{fieldErrors.email}</FieldError>
        </div>
        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" required value={form.phone} onChange={(e) => set({ phone: e.target.value })} />
          <FieldError>{fieldErrors.phone}</FieldError>
        </div>
      </div>
      <div>
        <Label htmlFor="zip">ZIP(s), comma-separated</Label>
        <Input id="zip" required value={form.zip} onChange={(e) => set({ zip: e.target.value })} placeholder="10465, 10462" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label htmlFor="bedrooms">Min bedrooms</Label>
          <Input id="bedrooms" type="number" min="0" value={form.bedrooms} onChange={(e) => set({ bedrooms: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="bathrooms">Min bathrooms</Label>
          <Input id="bathrooms" type="number" min="0" value={form.bathrooms} onChange={(e) => set({ bathrooms: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="familySize">Family size</Label>
          <Input id="familySize" type="number" min="1" value={form.familySize} onChange={(e) => set({ familySize: e.target.value })} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label htmlFor="basement">Basement</Label>
          <Select id="basement" value={form.basement} onChange={(e) => set({ basement: e.target.value })}>
            {TRI_STATE_OPTIONS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="parking">Parking</Label>
          <Select id="parking" value={form.parking} onChange={(e) => set({ parking: e.target.value })}>
            {TRI_STATE_OPTIONS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="listingType">Buy or rent</Label>
          <Select id="listingType" value={form.listingType} onChange={(e) => set({ listingType: e.target.value })}>
            <option value="buy">Buy</option>
            <option value="rent">Rent</option>
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor="homeType">Home type(s), comma-separated</Label>
        <Input
          id="homeType"
          value={form.homeType}
          onChange={(e) => set({ homeType: e.target.value })}
          placeholder="Single family, Condo"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="minSqft">Min square feet</Label>
          <Input id="minSqft" type="number" min="0" value={form.minSqft} onChange={(e) => set({ minSqft: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="minYearBuilt">Min year built</Label>
          <Input id="minYearBuilt" type="number" value={form.minYearBuilt} onChange={(e) => set({ minYearBuilt: e.target.value })} />
        </div>
      </div>
    </div>
  );
}
