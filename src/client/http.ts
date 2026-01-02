import { AuthenticationError, SessionExpiredError, RateLimitError } from "../utils/errors.js";

const BASE_URL = "https://www.myfitnesspal.com";

const DEFAULT_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
  "Pragma": "no-cache",
};

export interface MFPHttpClient {
  get(path: string): Promise<string>;
  post(path: string, data: Record<string, string>): Promise<string>;
  validateSession(): Promise<boolean>;
}

export function createHttpClient(cookie: string): MFPHttpClient {
  const headers = {
    ...DEFAULT_HEADERS,
    Cookie: cookie,
  };

  async function request(
    path: string,
    options: RequestInit = {}
  ): Promise<string> {
    const url = `${BASE_URL}${path}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...(options.headers || {}),
      },
      redirect: "manual",
    });

    // Check for auth redirects
    if (response.status === 302 || response.status === 301) {
      const location = response.headers.get("location");
      if (location?.includes("/account/login") || location?.includes("login")) {
        throw new SessionExpiredError();
      }
    }

    if (response.status === 401 || response.status === 403) {
      throw new AuthenticationError();
    }

    if (response.status === 429) {
      throw new RateLimitError();
    }

    if (!response.ok && response.status !== 302) {
      throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
    }

    // Follow redirects manually to maintain cookies
    if (response.status === 302) {
      const location = response.headers.get("location");
      if (location && !location.includes("/account/login")) {
        return request(location.replace(BASE_URL, ""), options);
      }
    }

    return response.text();
  }

  return {
    async get(path: string): Promise<string> {
      return request(path, { method: "GET" });
    },

    async post(path: string, data: Record<string, string>): Promise<string> {
      const body = new URLSearchParams(data).toString();
      return request(path, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });
    },

    async validateSession(): Promise<boolean> {
      try {
        const html = await request("/food/diary");
        // If we get the diary page without redirect to login, session is valid
        const hasLoginForm = html.includes('action="/account/login"') || html.includes('id="login"');
        const hasDiary = html.includes("diary") || html.includes("food-diary") || html.includes("Breakfast");
        return !hasLoginForm && hasDiary;
      } catch (error) {
        if (error instanceof AuthenticationError || error instanceof SessionExpiredError) {
          return false;
        }
        throw error;
      }
    },
  };
}
