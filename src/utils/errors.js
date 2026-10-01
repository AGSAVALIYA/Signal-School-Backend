// Every API error has a stable code; the frontend translates codes, `message` is an English fallback.
const MESSAGES = {
  VALIDATION: 'Some fields are invalid',
  UNAUTHENTICATED: 'Please log in',
  SESSION_EXPIRED: 'Your session has ended, please log in again',
  INVALID_CREDENTIALS: 'Wrong email/mobile or password',
  ACCOUNT_INACTIVE: 'This account is inactive. Contact the school office',
  ACCOUNT_LOCKED: 'Too many failed attempts. Try again later',
  FORBIDDEN: 'You do not have permission to do this',
  NOT_FOUND: 'Not found',
  NO_SCHOOL: 'No school is linked to this account',
  NO_ACTIVE_YEAR: 'No current academic year. Ask the admin to create one',
  YEAR_CLOSED: 'This academic year is closed. Ask the admin to unlock it',
  YEAR_HAS_DATA: 'This academic year has data and cannot be deleted',
  YEAR_OVERLAP: 'Dates overlap another academic year',
  DUPLICATE: 'This already exists',
  IN_USE: 'This is in use and cannot be deleted',
  GR_DUPLICATE: 'This register (GR) number is already used',
  DATE_IN_FUTURE: 'Date cannot be in the future',
  DATE_OUTSIDE_YEAR: 'Date is outside the academic year',
  ATTENDANCE_LOCKED: 'Attendance for this date can no longer be changed',
  WRONG_PASSWORD: 'Current password is wrong',
  ROLLOVER_INVALID: 'The new-year plan is incomplete',
  FILE_TYPE: 'This file type is not allowed',
  FILE_TOO_LARGE: 'File is too large',
  TOPIC_HAS_COMPLETION: 'A topic that was already taught cannot be removed',
  RATE_LIMITED: 'Too many requests. Please wait a moment',
  INTERNAL: 'Something went wrong. Please try again',
};

class AppError extends Error {
  constructor(status, code, { params, fields } = {}) {
    super(MESSAGES[code] || code);
    Object.assign(this, { status, code, params, fields });
  }
}

const badRequest = (code = 'VALIDATION', opts) => new AppError(400, code, opts);
const forbidden = () => new AppError(403, 'FORBIDDEN');
const notFound = () => new AppError(404, 'NOT_FOUND');
const conflict = (code, opts) => new AppError(409, code, opts);

module.exports = { AppError, MESSAGES, badRequest, forbidden, notFound, conflict };
