import type { ContentfulStatusCode } from "hono/utils/http-status";

export class ApiHttpError extends Error {
  readonly code: string;
  readonly status: ContentfulStatusCode;
  readonly retryable: boolean;
  readonly details?: unknown;

  constructor(options: {
    code: string;
    message: string;
    status: ContentfulStatusCode;
    retryable?: boolean;
    details?: unknown;
  }) {
    super(options.message);
    this.name = "ApiHttpError";
    this.code = options.code;
    this.status = options.status;
    this.retryable = options.retryable ?? false;
    if (options.details !== undefined) this.details = options.details;
  }
}
