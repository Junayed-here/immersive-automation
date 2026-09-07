export function ok(res, status, data, message = '') {
  return res.status(status).json({ success: true, message, data });
}

export function fail(res, status, message, details, code) {
  const error = { message };
  if (details) error.details = details;
  if (code) error.code = code;
  return res.status(status).json({ success: false, error });
}
