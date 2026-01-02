export class MFPError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = "MFPError";
  }
}

export class AuthenticationError extends MFPError {
  constructor(message = "Authentication required. Please re-authenticate.") {
    super(message, "AUTH_REQUIRED", 401);
    this.name = "AuthenticationError";
  }
}

export class SessionExpiredError extends MFPError {
  constructor(message = "Session expired. Please re-authenticate.") {
    super(message, "SESSION_EXPIRED", 401);
    this.name = "SessionExpiredError";
  }
}

export class RateLimitError extends MFPError {
  constructor(message = "Rate limit exceeded. Please try again later.") {
    super(message, "RATE_LIMITED", 429);
    this.name = "RateLimitError";
  }
}

export class ParseError extends MFPError {
  constructor(message: string) {
    super(message, "PARSE_ERROR");
    this.name = "ParseError";
  }
}

export class ReadOnlyModeError extends MFPError {
  constructor(message = "Server is in read-only mode. Write operations are disabled.") {
    super(message, "READ_ONLY_MODE", 403);
    this.name = "ReadOnlyModeError";
  }
}
