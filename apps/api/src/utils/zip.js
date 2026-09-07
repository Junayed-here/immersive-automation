export function normalizeZip(raw) {
  return String(raw).trim().padStart(5, '0');
}

export function isValidZip(zip) {
  return /^\d{5}$/.test(zip);
}
