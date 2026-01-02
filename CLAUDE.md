# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MCP (Model Context Protocol) server providing access to MyFitnessPal nutrition data. Designed to be publishable to npm and runnable via `npx`.

## Tech Stack

- **Runtime**: Node.js 20+
- **Language**: TypeScript 5.x
- **Package Manager**: pnpm
- **MCP SDK**: `@modelcontextprotocol/sdk`
- **HTTP/Scraping**: `playwright` (authenticated browser sessions)
- **HTML Parsing**: `cheerio`
- **Validation**: `zod`
- **Cookie Storage**: `keytar` (OS keychain) with encrypted file fallback
- **Build**: `tsup`

## Commands

```bash
pnpm install          # Install dependencies
pnpm build            # Build with tsup
pnpm dev              # Build in watch mode
pnpm start            # Run the MCP server
pnpm auth             # Authenticate with MyFitnessPal
pnpm test             # Run tests with vitest
pnpm lint             # Lint with eslint
pnpm typecheck        # Type check without emit
```

## Architecture

### Entry Points
- `src/index.ts` - Main entry, MCP server setup
- `bin/cli.ts` - CLI entry for npx (`serve`, `auth`, `logout`, `test` commands)

### Core Modules

**Authentication (`src/auth/`)**
- `cookie-store.ts` - Cookie persistence via keytar/encrypted file
- `login.ts` - Playwright browser login flow
- `session.ts` - Session management, cookie refresh

**MFP Client (`src/client/`)**
- `http.ts` - HTTP client with cookie injection
- `diary.ts` - Diary/food log scraping from `/food/diary?date=YYYY-MM-DD`
- `goals.ts` - Goals scraping from `/account/my-goals`
- `food-search.ts` - Food database search from `/food/search?search=QUERY`
- `weight.ts` - Weight history from `/weight`

**MCP Tools (`src/tools/`)**
- `get-diary.ts` - Food diary entries for a date
- `get-goals.ts` - User's daily nutrition goals
- `search-food.ts` - Search MFP food database
- `log-food.ts` - Add food entry (requires CSRF handling)
- `get-weight.ts` - Weight tracking history
- `get-summary.ts` - Aggregated nutrition over date range

### Authentication Flow

1. User runs `npx @scope/mcp-myfitnesspal auth`
2. Playwright opens browser to MFP login
3. User logs in manually (handles 2FA, captcha)
4. Cookies extracted and stored in OS keychain (or encrypted file fallback)
5. MFP cookies expire after ~30 days; handle 401/redirects by prompting re-auth

### MCP Server Pattern

Uses `@modelcontextprotocol/sdk` with stdio transport:
- `ListToolsRequestSchema` handler returns tool definitions
- `CallToolRequestSchema` handler dispatches to tool implementations
- All tools return structured JSON responses

## Key Implementation Notes

- All HTML scraping uses Cheerio for parsing
- Handle CSRF tokens for mutation operations (log_food)
- Add rate limiting between requests
- Cache repeated requests for performance
- Session validation on each request with graceful expiry handling
