# MCP MyFitnessPal Server - Project Plan

## Overview

Build a TypeScript MCP (Model Context Protocol) server that provides access to MyFitnessPal nutrition data. The server should be publishable to npm and runnable via `npx`.

## Goals

1. **Zero-config startup**: Run with `npx @your-scope/mcp-myfitnesspal`
2. **Secure authentication**: One-time browser login, cookies stored securely
3. **Type-safe**: Full TypeScript with Zod validation
4. **Comprehensive**: Cover diary, goals, food search, weight tracking

---

## Tech Stack

- **Runtime**: Node.js 20+
- **Language**: TypeScript 5.x
- **MCP SDK**: `@modelcontextprotocol/sdk`
- **HTTP/Scraping**: `playwright` (for authenticated sessions)
- **HTML Parsing**: `cheerio` (for extracting data from HTML)
- **Validation**: `zod`
- **Cookie Storage**: `keytar` (OS keychain) or fallback to encrypted file
- **Build**: `tsup` (for bundling)
- **Package Manager**: `pnpm`

---

## Project Structure

```
mcp-myfitnesspal/
├── src/
│   ├── index.ts              # Entry point, MCP server setup
│   ├── server.ts             # MCP server definition with tools
│   ├── auth/
│   │   ├── index.ts          # Auth exports
│   │   ├── cookie-store.ts   # Cookie persistence (keytar/file)
│   │   ├── login.ts          # Playwright browser login flow
│   │   └── session.ts        # Session management, cookie refresh
│   ├── client/
│   │   ├── index.ts          # MFP client exports
│   │   ├── http.ts           # HTTP client with cookie injection
│   │   ├── diary.ts          # Diary/food log scraping
│   │   ├── goals.ts          # Goals scraping
│   │   ├── food-search.ts    # Food database search
│   │   └── weight.ts         # Weight history
│   ├── tools/
│   │   ├── index.ts          # Tool exports
│   │   ├── get-diary.ts      # get_diary tool
│   │   ├── get-goals.ts      # get_goals tool
│   │   ├── search-food.ts    # search_food tool
│   │   ├── log-food.ts       # log_food tool
│   │   ├── get-weight.ts     # get_weight_history tool
│   │   └── get-summary.ts    # get_nutrition_summary tool
│   ├── types/
│   │   ├── index.ts          # Type exports
│   │   ├── diary.ts          # Diary types
│   │   ├── food.ts           # Food/nutrition types
│   │   ├── goals.ts          # Goals types
│   │   └── weight.ts         # Weight types
│   └── utils/
│       ├── date.ts           # Date parsing/formatting
│       ├── parse.ts          # HTML parsing helpers
│       └── errors.ts         # Custom error classes
├── bin/
│   └── cli.ts                # CLI entry point for npx
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── README.md
```

---

## Authentication Flow

### First-time Setup

1. User runs `npx @scope/mcp-myfitnesspal auth`
2. Playwright opens a browser window to `https://www.myfitnesspal.com/account/login`
3. User logs in manually (handles 2FA, captcha, etc.)
4. After successful login, extract cookies from browser context
5. Store cookies securely:
   - Primary: OS keychain via `keytar`
   - Fallback: Encrypted JSON file in `~/.config/mcp-myfitnesspal/cookies.enc`
6. Close browser, confirm success

### Session Management

```typescript
// src/auth/session.ts
interface SessionManager {
  // Load cookies from storage
  loadCookies(): Promise<Cookie[] | null>;
  
  // Save cookies to storage
  saveCookies(cookies: Cookie[]): Promise<void>;
  
  // Check if session is valid (test request)
  validateSession(): Promise<boolean>;
  
  // Clear stored session
  clearSession(): Promise<void>;
}
```

### Cookie Refresh

- MFP cookies expire after ~30 days
- On each request, check for 401/redirect to login
- If expired, prompt user to re-authenticate

---

## MCP Tools Specification

### 1. `get_diary`

Get food diary entries for a specific date.

**Input Schema:**
```typescript
{
  date?: string;  // ISO date (YYYY-MM-DD), defaults to today
}
```

**Output:**
```typescript
{
  date: string;
  meals: {
    name: string;  // "Breakfast", "Lunch", "Dinner", "Snacks"
    entries: {
      name: string;
      brand?: string;
      amount: string;
      calories: number;
      carbs: number;
      fat: number;
      protein: number;
      sodium?: number;
      sugar?: number;
      fiber?: number;
    }[];
    totals: NutritionTotals;
  }[];
  totals: NutritionTotals;
  goals: NutritionTotals;
  remaining: NutritionTotals;
  water?: {
    cups: number;
    goal: number;
  };
}
```

**Implementation Notes:**
- Scrape from `https://www.myfitnesspal.com/food/diary?date=YYYY-MM-DD`
- Parse HTML table structure using Cheerio
- Handle empty days gracefully

---

### 2. `get_goals`

Get user's daily nutrition goals.

**Input Schema:**
```typescript
{}  // No input required
```

**Output:**
```typescript
{
  calories: number;
  carbs: { grams: number; percentage: number };
  fat: { grams: number; percentage: number };
  protein: { grams: number; percentage: number };
  sodium?: number;
  sugar?: number;
  fiber?: number;
  saturatedFat?: number;
  cholesterol?: number;
}
```

**Implementation Notes:**
- Scrape from `https://www.myfitnesspal.com/account/my-goals`
- Or extract from diary page goal row

---

### 3. `search_food`

Search the MFP food database.

**Input Schema:**
```typescript
{
  query: string;       // Search term
  page?: number;       // Pagination, default 1
  brandFilter?: string; // Optional brand filter
}
```

**Output:**
```typescript
{
  results: {
    id: string;
    name: string;
    brand?: string;
    calories: number;
    servingSize: string;
    verified: boolean;  // MFP verified checkmark
  }[];
  totalResults: number;
  page: number;
  hasMore: boolean;
}
```

**Implementation Notes:**
- Search endpoint: `https://www.myfitnesspal.com/food/search?search=QUERY`
- May need to handle AJAX/JSON endpoint if available
- Parse search results table

---

### 4. `log_food`

Add a food entry to the diary.

**Input Schema:**
```typescript
{
  foodId: string;           // From search results
  meal: "Breakfast" | "Lunch" | "Dinner" | "Snacks";
  servings: number;         // Number of servings
  date?: string;            // ISO date, defaults to today
}
```

**Output:**
```typescript
{
  success: boolean;
  entry?: {
    id: string;
    name: string;
    calories: number;
    // ... other nutrition
  };
  error?: string;
}
```

**Implementation Notes:**
- This requires form submission or API call
- Need to reverse-engineer the add food flow
- Handle CSRF tokens if present

---

### 5. `get_weight_history`

Get weight tracking history.

**Input Schema:**
```typescript
{
  startDate?: string;  // ISO date
  endDate?: string;    // ISO date
  limit?: number;      // Max entries, default 30
}
```

**Output:**
```typescript
{
  entries: {
    date: string;
    weight: number;
    unit: "kg" | "lb";
  }[];
  current?: number;
  goal?: number;
  startWeight?: number;
  progress?: number;  // Percentage to goal
}
```

**Implementation Notes:**
- Scrape from `https://www.myfitnesspal.com/weight`
- Or check for API/chart data endpoint

---

### 6. `get_nutrition_summary`

Get aggregated nutrition data over a date range.

**Input Schema:**
```typescript
{
  startDate: string;   // ISO date
  endDate: string;     // ISO date
}
```

**Output:**
```typescript
{
  period: { start: string; end: string };
  days: number;
  averages: NutritionTotals;
  totals: NutritionTotals;
  compliance: {
    daysLogged: number;
    daysUnderGoal: number;
    daysOverGoal: number;
  };
}
```

**Implementation Notes:**
- Fetch each day's diary and aggregate
- Consider caching for performance
- MFP may have a reports page to scrape

---

## Shared Types

```typescript
// src/types/index.ts

interface NutritionTotals {
  calories: number;
  carbs: number;
  fat: number;
  protein: number;
  sodium?: number;
  sugar?: number;
  fiber?: number;
  saturatedFat?: number;
  cholesterol?: number;
}

interface Cookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
}
```

---

## MCP Server Setup

```typescript
// src/server.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new Server(
  {
    name: "mcp-myfitnesspal",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "get_diary",
      description: "Get food diary entries for a specific date",
      inputSchema: {
        type: "object",
        properties: {
          date: {
            type: "string",
            description: "Date in YYYY-MM-DD format (defaults to today)",
          },
        },
      },
    },
    // ... other tools
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  switch (name) {
    case "get_diary":
      return handleGetDiary(args);
    // ... other handlers
  }
});
```

---

## CLI Commands

```typescript
// bin/cli.ts
#!/usr/bin/env node

import { Command } from "commander";

const program = new Command();

program
  .name("mcp-myfitnesspal")
  .description("MyFitnessPal MCP Server")
  .version("1.0.0");

program
  .command("serve")
  .description("Start the MCP server (default)")
  .action(startServer);

program
  .command("auth")
  .description("Authenticate with MyFitnessPal")
  .action(runAuthFlow);

program
  .command("logout")
  .description("Clear stored credentials")
  .action(clearAuth);

program
  .command("test")
  .description("Test the connection")
  .action(testConnection);

// Default to serve if no command
if (process.argv.length === 2) {
  startServer();
} else {
  program.parse();
}
```

---

## Package.json

```json
{
  "name": "@your-scope/mcp-myfitnesspal",
  "version": "1.0.0",
  "description": "MCP server for MyFitnessPal nutrition tracking",
  "type": "module",
  "bin": {
    "mcp-myfitnesspal": "./dist/cli.js"
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "start": "node dist/cli.js",
    "auth": "node dist/cli.js auth",
    "test": "vitest",
    "lint": "eslint src",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "playwright": "^1.40.0",
    "cheerio": "^1.0.0-rc.12",
    "zod": "^3.22.0",
    "keytar": "^7.9.0",
    "commander": "^12.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.3.0",
    "tsup": "^8.0.0",
    "vitest": "^1.0.0",
    "eslint": "^8.56.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0"
  },
  "engines": {
    "node": ">=20.0.0"
  },
  "keywords": ["mcp", "myfitnesspal", "nutrition", "fitness", "ai"],
  "license": "MIT"
}
```

---

## Build Configuration

```typescript
// tsup.config.ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    cli: "bin/cli.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true,
  shims: true,
  banner: {
    js: "#!/usr/bin/env node",
  },
});
```

---

## Implementation Order

### Phase 1: Foundation
1. [ ] Set up project structure and dependencies
2. [ ] Implement cookie storage (keytar + file fallback)
3. [ ] Implement Playwright auth flow
4. [ ] Create HTTP client with cookie injection
5. [ ] Basic MCP server skeleton

### Phase 2: Core Tools
6. [ ] Implement `get_diary` (most important)
7. [ ] Implement `get_goals`
8. [ ] Test with Claude Desktop

### Phase 3: Extended Features
9. [ ] Implement `search_food`
10. [ ] Implement `get_weight_history`
11. [ ] Implement `get_nutrition_summary`
12. [ ] Implement `log_food` (if feasible)

### Phase 4: Polish
13. [ ] Error handling and retry logic
14. [ ] Rate limiting
15. [ ] Caching for repeated requests
16. [ ] CLI improvements
17. [ ] Documentation
18. [ ] Publish to npm

---

## MFP Website Structure (Research Notes)

### Key URLs to Scrape

| Feature | URL | Notes |
|---------|-----|-------|
| Diary | `/food/diary?date=YYYY-MM-DD` | Main food log |
| Food Search | `/food/search?search=QUERY` | Database search |
| Add Food | `/food/add_to_diary` | POST form |
| Goals | `/account/my-goals` | Nutrition targets |
| Weight | `/weight` | Weight history |
| Reports | `/reports` | Weekly summaries |

### Authentication Headers

When making requests, include:
- Cookies from browser session
- User-Agent matching browser
- Accept headers for HTML

### Potential Issues

1. **CSRF Tokens**: MFP likely uses CSRF protection for mutations
2. **Rate Limiting**: Don't spam requests, add delays
3. **HTML Changes**: Website structure may change, tests needed
4. **Session Expiry**: Handle 401/redirects gracefully

---

## Testing Strategy

1. **Unit Tests**: Parse functions with sample HTML
2. **Integration Tests**: Real requests with test account (manual)
3. **Mock Data**: Store sample HTML responses for CI

---

## Example MCP Config (for Claude Desktop)

```json
{
  "mcpServers": {
    "myfitnesspal": {
      "command": "npx",
      "args": ["@your-scope/mcp-myfitnesspal"]
    }
  }
}
```

Or if installed globally:

```json
{
  "mcpServers": {
    "myfitnesspal": {
      "command": "mcp-myfitnesspal"
    }
  }
}
```

---

## Success Criteria

1. ✅ Can authenticate via browser flow
2. ✅ Can fetch today's diary with nutrition breakdown
3. ✅ Can search food database
4. ✅ Can get daily goals
5. ✅ Can get weight history
6. ✅ Works with Claude Desktop
7. ✅ Runnable via `npx`
8. ✅ Handles errors gracefully
9. ✅ Session persists between runs
