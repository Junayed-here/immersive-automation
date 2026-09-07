export class SpreadsheetUrlError extends Error {
  constructor(message, code = 'INVALID_URL') {
    super(message);
    this.name = 'SpreadsheetUrlError';
    this.code = code;
    this.status = 400;
  }
}

export class SpreadsheetFetchError extends Error {
  constructor(message, code, status = 502) {
    super(message);
    this.name = 'SpreadsheetFetchError';
    this.code = code;
    this.status = status;
  }
}

export class SpreadsheetSyncError extends Error {
  constructor(message, code, status = 422) {
    super(message);
    this.name = 'SpreadsheetSyncError';
    this.code = code;
    this.status = status;
  }
}
