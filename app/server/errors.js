/**
 * HttpError — error class yang membawa HTTP status code.
 */

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}
