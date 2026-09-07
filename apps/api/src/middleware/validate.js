import { ZodError } from 'zod';
import { fail } from '../utils/respond.js';

export function validate(schema, source = 'body') {
  return function validateMiddleware(req, res, next) {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      return fail(res, 400, 'Request failed validation.', formatZodError(result.error));
    }

    req[source] = result.data;
    return next();
  };
}

export function formatZodError(error) {
  if (!(error instanceof ZodError)) return [];
  return error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));
}
