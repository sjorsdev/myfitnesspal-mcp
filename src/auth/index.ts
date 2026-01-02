export function getCookieFromEnv(): string | null {
  return process.env.MFP_COOKIE || null;
}

export function validateCookie(cookie: string | null): cookie is string {
  return cookie !== null && cookie.length > 0;
}
