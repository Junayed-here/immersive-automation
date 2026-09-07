import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '../../config/env.js';
import { SpreadsheetFetchError } from './errors.js';

const ALLOWED_HOSTS = new Set(['docs.google.com']);
const ALLOWED_HOST_SUFFIXES = ['.googleusercontent.com'];
const MAX_BYTES = 10 * 1024 * 1024;
const TIMEOUT_MS = 15000;
const MAX_REDIRECTS = 5;

function isAllowedHost(hostname) {
  if (ALLOWED_HOSTS.has(hostname)) return true;
  return ALLOWED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix));
}

/**
 * Fetches the export URL we rebuilt ourselves (see urlParser.js) - never a raw
 * realtor-supplied URL. Redirects are followed manually so every hop's host can
 * be validated (Google's CSV export redirects to a googleusercontent.com host).
 */
export class HttpSheetFetcher {
  async fetchCsv({ exportUrl }) {
    let currentUrl = exportUrl;

    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      const url = new URL(currentUrl);
      if (!isAllowedHost(url.hostname)) {
        throw new SpreadsheetFetchError(
          `Refused to follow redirect to disallowed host "${url.hostname}".`,
          'INVALID_REDIRECT_HOST',
          502
        );
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

      let response;
      try {
        response = await fetch(currentUrl, { redirect: 'manual', signal: controller.signal });
      } catch (err) {
        if (err.name === 'AbortError') {
          throw new SpreadsheetFetchError('Timed out fetching the spreadsheet.', 'FETCH_TIMEOUT', 504);
        }
        throw new SpreadsheetFetchError(`Failed to fetch the spreadsheet: ${err.message}`, 'FETCH_FAILED', 502);
      } finally {
        clearTimeout(timeout);
      }

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) {
          throw new SpreadsheetFetchError('Redirect response missing Location header.', 'FETCH_FAILED', 502);
        }
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }

      const contentType = response.headers.get('content-type') || '';
      const body = await readBodyWithCap(response);
      return { contentType, body, status: response.status };
    }

    throw new SpreadsheetFetchError('Too many redirects.', 'TOO_MANY_REDIRECTS', 502);
  }
}

async function readBodyWithCap(response) {
  if (!response.body) {
    const text = await response.text();
    if (Buffer.byteLength(text, 'utf8') > MAX_BYTES) {
      throw new SpreadsheetFetchError('Spreadsheet export exceeded the 10MB size cap.', 'SIZE_LIMIT_EXCEEDED', 413);
    }
    return text;
  }

  const reader = response.body.getReader();
  let received = 0;
  const chunks = [];
  for (;;) {
    // eslint-disable-next-line no-await-in-loop
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > MAX_BYTES) {
      await reader.cancel();
      throw new SpreadsheetFetchError('Spreadsheet export exceeded the 10MB size cap.', 'SIZE_LIMIT_EXCEEDED', 413);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString('utf8');
}

/**
 * Reads fixtures from data/fixtures/ for local dev and tests - zero network.
 * The fileId is just the fixture's basename (e.g. a "url" of
 * https://docs.google.com/spreadsheets/d/buyers-messy/edit#gid=0 maps to
 * data/fixtures/buyers-messy.csv).
 */
export class LocalSheetFetcher {
  async fetchCsv({ fileId }) {
    const csvPath = path.join(env.spreadsheetFixturesDir, `${fileId}.csv`);
    const htmlPath = path.join(env.spreadsheetFixturesDir, `${fileId}.html`);

    if (await exists(csvPath)) {
      const body = await fs.readFile(csvPath, 'utf8');
      return { contentType: 'text/csv', body, status: 200 };
    }
    if (await exists(htmlPath)) {
      const body = await fs.readFile(htmlPath, 'utf8');
      return { contentType: 'text/html', body, status: 200 };
    }
    throw new SpreadsheetFetchError(`No local fixture found for "${fileId}".`, 'FIXTURE_NOT_FOUND', 404);
  }
}

async function exists(candidatePath) {
  try {
    await fs.access(candidatePath);
    return true;
  } catch {
    return false;
  }
}

export function getSheetFetcher() {
  return env.sheetFetcher === 'local' ? new LocalSheetFetcher() : new HttpSheetFetcher();
}
