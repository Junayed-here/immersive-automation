import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBuyersCsv } from '../src/services/spreadsheet/parser.js';

const HEADER =
  'NAME,EMAIL,PHONE,INT_ZIP,INT_FAMILY,INT_BEDROOM,INT_BATHROOMS,INT_BASEMENT,INT_HOME_TYPE,INT_PARKING,INT_SQUARE_FEET,INT_YEAR_BUILT,INT_LISTING_TYPE,EMAIL_OPTIN,SMS_OPTIN,WHATSAPP_OPTIN';

function csv(rows) {
  return [HEADER, ...rows].join('\n');
}

test('a fully-populated row parses every field correctly', () => {
  const { rows, errors } = parseBuyersCsv(
    csv(['Jane Doe,jane@example.com,555-1234,10465,3,2,1,Yes,"Single Family, Condo",No,1200,2000,Rent,No,Yes,'])
  );
  assert.equal(errors.length, 0);
  assert.equal(rows.length, 1);
  const row = rows[0];
  assert.equal(row.name, 'Jane Doe');
  assert.equal(row.email, 'jane@example.com');
  assert.equal(row.phone, '555-1234');
  assert.deepEqual(row.zipCodes, ['10465']);
  assert.equal(row.familySize, 3);
  assert.equal(row.bedrooms, 2);
  assert.equal(row.bathrooms, 1);
  assert.equal(row.basement, true);
  assert.deepEqual(row.homeType, ['SINGLE_FAMILY', 'CONDO']);
  assert.equal(row.parking, false);
  assert.equal(row.minSqft, 1200);
  assert.equal(row.minYearBuilt, 2000);
  assert.equal(row.listingType, 'rent');
  assert.equal(row.subscribed, false);
  assert.equal(row.smsOptIn, true);
  assert.equal(row.whatsappOptIn, false);
});

test('a row with only the required fields sends everything in the ZIP (all filters unset)', () => {
  const { rows, errors } = parseBuyersCsv(csv(['John Buyer,john@example.com,555-0000,07069,,,,,,,,,,,,']));
  assert.equal(errors.length, 0);
  const row = rows[0];
  assert.deepEqual(row.zipCodes, ['07069']);
  assert.equal(row.familySize, undefined);
  assert.equal(row.basement, undefined);
  assert.deepEqual(row.homeType, []);
  assert.equal(row.parking, undefined);
  assert.equal(row.listingType, 'buy');
  assert.equal(row.subscribed, true); // EMAIL_OPTIN blank defaults to opted-in
  assert.equal(row.smsOptIn, false); // SMS/WHATSAPP_OPTIN blank defaults to opted-out
});

test('multiple ZIPs in one cell are all kept, normalized to 5 digits', () => {
  const { rows } = parseBuyersCsv(csv(['Multi Zip,mz@example.com,555-1111,"10465; 7069 10001",,,,,,,,,,,,']));
  assert.deepEqual(rows[0].zipCodes, ['10465', '07069', '10001']);
});

test('junk tokens inside a multi-ZIP cell are dropped, valid ones kept', () => {
  const { rows } = parseBuyersCsv(csv(['Junk Zip,jz@example.com,555-2222,"10465, N/A, 10462",,,,,,,,,,,,']));
  assert.deepEqual(rows[0].zipCodes, ['10465', '10462']);
});

test('missing name is a row error, not an abort', () => {
  const { rows, errors } = parseBuyersCsv(
    csv([',noname@example.com,555-3333,10465,,,,,,,,,,,,', 'Valid Row,valid@example.com,555-4444,10465,,,,,,,,,,,,'])
  );
  assert.equal(rows.length, 1);
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /name/i);
});

test('missing or invalid email is a row error', () => {
  const { rows, errors } = parseBuyersCsv(csv(['No Email,not-an-email,555-5555,10465,,,,,,,,,,,,']));
  assert.equal(rows.length, 0);
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /email/i);
});

test('missing phone is a row error', () => {
  const { rows, errors } = parseBuyersCsv(csv(['No Phone,nophone@example.com,,10465,,,,,,,,,,,,']));
  assert.equal(rows.length, 0);
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /phone/i);
});

test('missing or entirely invalid ZIP is a row error', () => {
  const { rows, errors } = parseBuyersCsv(csv(['No Zip,nozip@example.com,555-6666,,,,,,,,,,,,,']));
  assert.equal(rows.length, 0);
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /zip/i);
});

test('duplicate emails: last row wins and duplicates are counted', () => {
  const { rows, duplicates } = parseBuyersCsv(
    csv([
      'First,dup@example.com,555-7777,10465,,,,,,,,,,,,',
      'Second,dup@example.com,555-8888,10462,,,,,,,,,,,,',
    ])
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, 'Second');
  assert.deepEqual(rows[0].zipCodes, ['10462']);
  assert.equal(duplicates, 1);
});

test('trailing blank header columns are tolerated, not a crash', () => {
  const headerWithBlanks = `${HEADER},,,`;
  const body = [headerWithBlanks, 'Blank Cols,bc@example.com,555-9999,10465,,,,,,,,,,,,,,,'].join('\n');
  const { rows, errors } = parseBuyersCsv(body);
  assert.equal(errors.length, 0);
  assert.equal(rows.length, 1);
});
