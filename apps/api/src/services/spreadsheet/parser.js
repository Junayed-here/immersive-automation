import { parse } from 'csv-parse/sync';
import { normalizeHomeType } from '../matching/homeTypes.js';

const HEADER_ALIASES = {
  name: ['name', 'full name', 'client name'],
  email: ['email', 'email address', 'e-mail', 'e-mail address'],
  phone: ['phone', 'phone number', 'mobile', 'mobile number'],
  zip: ['zip', 'zip code', 'zipcode', 'postal code', 'int zip'],
  familySize: ['family size', 'familysize', 'household size', 'int family'],
  bedrooms: ['bedrooms', 'beds', 'bedroom', 'number of bedrooms', 'int bedroom'],
  bathrooms: ['bathrooms', 'baths', 'bathroom', 'int bathrooms'],
  basement: ['basement', 'int basement'],
  homeType: ['home type', 'hometype', 'property type', 'int home type'],
  parking: ['parking', 'int parking'],
  minSqft: ['square feet', 'sqft', 'square footage', 'int square feet'],
  minYearBuilt: ['year built', 'yearbuilt', 'int year built'],
  listingType: ['listing type', 'listingtype', 'int listing type'],
  emailOptIn: ['email optin', 'email opt-in', 'email opt in'],
  smsOptIn: ['sms optin', 'sms opt-in', 'sms opt in'],
  whatsappOptIn: ['whatsapp optin', 'whatsapp opt-in', 'whatsapp opt in'],
};

// Realtors phrase columns all kinds of ways ("Interested Zip", "Desired Bed
// Count"). Exact aliases above cover the common cases; this is a looser
// keyword fallback for anything left unmapped, checked in fixed field order
// so a short keyword like "bed" can't steal a header before more specific
// fields get a chance to claim it.
const HEADER_KEYWORDS = [
  ['email', ['mail']],
  ['zip', ['zip', 'postal']],
  ['familySize', ['family', 'household']],
  ['bathrooms', ['bath']],
  ['bedrooms', ['bed']],
  ['basement', ['basement']],
  ['homeType', ['home type', 'property type']],
  ['parking', ['park']],
  ['minSqft', ['sqft', 'square feet', 'square footage']],
  ['minYearBuilt', ['year built']],
  ['listingType', ['listing type']],
  ['smsOptIn', ['sms']],
  ['whatsappOptIn', ['whatsapp']],
  ['phone', ['phone', 'mobile', 'cell']],
  ['name', ['name']],
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_ERRORS = 50;
const TRUE_VALUES = new Set(['yes', 'y', 'true', '1']);
const FALSE_VALUES = new Set(['no', 'n', 'false', '0']);

function normalizeHeaderKey(header) {
  return header.trim().toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
}

function buildHeaderMap(headers) {
  const map = {};
  headers.forEach((header) => {
    const key = normalizeHeaderKey(header);
    Object.entries(HEADER_ALIASES).forEach(([field, aliases]) => {
      if (!(field in map) && aliases.includes(key)) {
        map[field] = header;
      }
    });
  });

  const claimed = new Set(Object.values(map));
  headers.forEach((header) => {
    if (claimed.has(header)) return;
    const key = normalizeHeaderKey(header);
    for (const [field, keywords] of HEADER_KEYWORDS) {
      if (!(field in map) && keywords.some((kw) => key.includes(kw))) {
        map[field] = header;
        claimed.add(header);
        break;
      }
    }
  });

  return map;
}

function toOptionalNumber(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === '') return undefined;
  const num = Number(raw);
  return Number.isNaN(num) ? undefined : num;
}

// undefined = no preference either way (blank cell) - distinct from an
// explicit false. Used for basement/parking, where "must not have one" and
// "don't care" are different filters.
function parseTriBoolean(raw) {
  const key = String(raw ?? '').trim().toLowerCase();
  if (!key) return undefined;
  if (TRUE_VALUES.has(key)) return true;
  if (FALSE_VALUES.has(key)) return false;
  return undefined;
}

function parseOptIn(raw, defaultValue) {
  const parsed = parseTriBoolean(raw);
  return parsed === undefined ? defaultValue : parsed;
}

// "10465, 10462" -> ["10465", "10462"]. At least one must survive validation
// (checked by the caller) - individual junk tokens are dropped rather than
// failing the whole row, matching the file's existing lenient style.
function parseZipList(raw) {
  return String(raw || '')
    .split(/[,;\s]+/)
    .map((token) => token.trim())
    .filter((token) => /^\d{1,5}$/.test(token))
    .map((token) => token.padStart(5, '0'));
}

function parseListingType(raw) {
  const key = String(raw || '').trim().toLowerCase();
  return key === 'rent' ? 'rent' : 'buy';
}

function parseHomeTypeList(raw) {
  return String(raw || '')
    .split(',')
    .map((token) => normalizeHomeType(token))
    .filter(Boolean);
}

/**
 * CSV -> normalized buyer rows. Bad rows never abort the import - they land
 * in errors[] (capped at 50) and everything else keeps processing. Rows are
 * deduped by email with last-row-wins, matching how a realtor re-exports a
 * corrected sheet. name/email/phone/zip are required; everything else is an
 * optional filter - a buyer with none of them set matches every listing in
 * their ZIP(s), since matchListings() skips any filter that isn't set.
 */
export function parseBuyersCsv(csvText) {
  const records = parse(csvText, {
    columns: (headerRow) => headerRow.map((h, i) => (h && h.trim() ? h : `__blank_${i}`)),
    skip_empty_lines: true,
    trim: true,
  });

  if (records.length === 0) {
    return { headers: [], rows: [], errors: [], duplicates: 0 };
  }

  const headers = Object.keys(records[0]).filter((h) => !h.startsWith('__blank_'));
  const headerMap = buildHeaderMap(headers);

  const errors = [];
  const byEmail = new Map();
  let duplicates = 0;

  records.forEach((record, index) => {
    const rowNumber = index + 2; // 1-indexed + header row
    const field = (key) => (headerMap[key] ? record[headerMap[key]] : undefined);

    const name = String(field('name') || '').trim();
    if (!name) {
      if (errors.length < MAX_ERRORS) errors.push({ row: rowNumber, message: 'Missing name.' });
      return;
    }

    const email = String(field('email') || '').trim().toLowerCase();
    if (!email || !EMAIL_RE.test(email)) {
      if (errors.length < MAX_ERRORS) errors.push({ row: rowNumber, message: 'Missing or invalid email.' });
      return;
    }

    const phone = String(field('phone') || '').trim();
    if (!phone) {
      if (errors.length < MAX_ERRORS) errors.push({ row: rowNumber, email, message: 'Missing phone.' });
      return;
    }

    const zipCodes = parseZipList(field('zip'));
    if (zipCodes.length === 0) {
      if (errors.length < MAX_ERRORS) {
        errors.push({ row: rowNumber, email, message: 'Missing or invalid ZIP (at least one required).' });
      }
      return;
    }

    if (byEmail.has(email)) {
      duplicates += 1;
    }

    byEmail.set(email, {
      name,
      email,
      phone,
      zipCodes,
      familySize: toOptionalNumber(field('familySize')),
      bedrooms: toOptionalNumber(field('bedrooms')),
      bathrooms: toOptionalNumber(field('bathrooms')),
      basement: parseTriBoolean(field('basement')),
      homeType: parseHomeTypeList(field('homeType')),
      parking: parseTriBoolean(field('parking')),
      minSqft: toOptionalNumber(field('minSqft')),
      minYearBuilt: toOptionalNumber(field('minYearBuilt')),
      listingType: parseListingType(field('listingType')),
      subscribed: parseOptIn(field('emailOptIn'), true),
      smsOptIn: parseOptIn(field('smsOptIn'), false),
      whatsappOptIn: parseOptIn(field('whatsappOptIn'), false),
      sourceRow: rowNumber,
    });
  });

  return { headers, rows: Array.from(byEmail.values()), errors, duplicates };
}
