/**
 * A private Google Sheet returns 200 OK with an HTML sign-in page, not a 403.
 * A status-code check alone will happily "parse" that login page as client data,
 * so every fetch result must be sniffed before it's handed to the CSV parser.
 */
export function isPrivateSheetResponse(contentType, body) {
  if (contentType && contentType.toLowerCase().includes('text/html')) {
    return true;
  }
  const trimmed = String(body || '').trimStart();
  return /^<!DOCTYPE/i.test(trimmed);
}
