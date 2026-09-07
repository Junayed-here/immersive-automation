import { SpreadsheetUrlError } from './errors.js';

const ALLOWED_HOST = 'docs.google.com';
const FILE_ID_PATTERN = /\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/;
const GID_HASH_PATTERN = /gid=([0-9]+)/;

/**
 * Never fetch a realtor-supplied URL directly (SSRF). This only ever reads the
 * fileId/gid out of it; the actual export URL is rebuilt from scratch below.
 */
export function parseSheetUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(String(rawUrl).trim());
  } catch {
    throw new SpreadsheetUrlError('Not a valid URL.', 'INVALID_URL');
  }

  if (parsed.hostname !== ALLOWED_HOST) {
    throw new SpreadsheetUrlError(
      `Only Google Sheets links (${ALLOWED_HOST}) are supported.`,
      'INVALID_HOST'
    );
  }

  const match = parsed.pathname.match(FILE_ID_PATTERN);
  if (!match) {
    throw new SpreadsheetUrlError('Could not find a spreadsheet ID in that URL.', 'INVALID_URL');
  }
  const fileId = match[1];

  const gid = parsed.searchParams.get('gid') || extractGidFromHash(parsed.hash) || '0';
  const exportUrl = `https://${ALLOWED_HOST}/spreadsheets/d/${fileId}/export?format=csv&gid=${encodeURIComponent(gid)}`;

  return { fileId, gid, exportUrl };
}

function extractGidFromHash(hash) {
  if (!hash) return null;
  const match = hash.match(GID_HASH_PATTERN);
  return match ? match[1] : null;
}
