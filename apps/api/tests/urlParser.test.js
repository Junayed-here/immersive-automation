import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSheetUrl } from '../src/services/spreadsheet/urlParser.js';
import { SpreadsheetUrlError } from '../src/services/spreadsheet/errors.js';

const FILE_ID = '1AbCdEfGhIjKlMnOpQrStUvWxYz1234567890';

test('edit URL with gid in hash', () => {
  const { fileId, gid } = parseSheetUrl(`https://docs.google.com/spreadsheets/d/${FILE_ID}/edit#gid=987654321`);
  assert.equal(fileId, FILE_ID);
  assert.equal(gid, '987654321');
});

test('edit URL with usp=sharing, no gid -> defaults to 0', () => {
  const { fileId, gid } = parseSheetUrl(`https://docs.google.com/spreadsheets/d/${FILE_ID}/edit?usp=sharing`);
  assert.equal(fileId, FILE_ID);
  assert.equal(gid, '0');
});

test('bare URL with no /edit suffix', () => {
  const { fileId, gid } = parseSheetUrl(`https://docs.google.com/spreadsheets/d/${FILE_ID}`);
  assert.equal(fileId, FILE_ID);
  assert.equal(gid, '0');
});

test('gid present in both query string and hash', () => {
  const { fileId, gid } = parseSheetUrl(`https://docs.google.com/spreadsheets/d/${FILE_ID}/edit?gid=555#gid=555`);
  assert.equal(fileId, FILE_ID);
  assert.equal(gid, '555');
});

test('htmlview URL form', () => {
  const { fileId, gid } = parseSheetUrl(`https://docs.google.com/spreadsheets/d/${FILE_ID}/htmlview#gid=0`);
  assert.equal(fileId, FILE_ID);
  assert.equal(gid, '0');
});

test('export URL is always rebuilt from the parsed fileId/gid, never the raw input', () => {
  const { exportUrl } = parseSheetUrl(`https://docs.google.com/spreadsheets/d/${FILE_ID}/edit?usp=sharing#gid=42`);
  assert.equal(exportUrl, `https://docs.google.com/spreadsheets/d/${FILE_ID}/export?format=csv&gid=42`);
});

test('non-Google host is rejected with INVALID_HOST before any network call', () => {
  assert.throws(
    () => parseSheetUrl(`https://evil.example.com/spreadsheets/d/${FILE_ID}/edit`),
    (err) => err instanceof SpreadsheetUrlError && err.code === 'INVALID_HOST' && err.status === 400
  );
});

test('Google host but wrong product (Docs, not Sheets) is rejected', () => {
  assert.throws(
    () => parseSheetUrl(`https://docs.google.com/document/d/${FILE_ID}/edit`),
    (err) => err instanceof SpreadsheetUrlError && err.code === 'INVALID_URL'
  );
});

test('garbage input is rejected, not thrown as an unhandled error', () => {
  assert.throws(() => parseSheetUrl('not a url at all'), SpreadsheetUrlError);
});
