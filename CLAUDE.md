# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MCP (Model Context Protocol) server providing access to MyFitnessPal nutrition data. Publishable to npm as `@mcp-collections/myfitnesspal`.

## Tech Stack

- **Runtime**: Node.js 20+
- **Language**: TypeScript 5.x
- **Package Manager**: pnpm
- **MCP SDK**: `@modelcontextprotocol/sdk`
- **HTML Parsing**: `cheerio`
- **Validation**: `zod`
- **Build**: `tsup`

## Commands

```bash
pnpm install          # Install dependencies
pnpm build            # Build with tsup
pnpm dev              # Build in watch mode
pnpm start            # Run the MCP server
node dist/cli.js test # Test connection with cookie
pnpm lint             # Lint with eslint
pnpm typecheck        # Type check without emit
```

## Architecture

### Entry Points
- `src/index.ts` - Main exports for the library
- `src/server.ts` - MCP server creation and tool handlers
- `bin/cli.ts` - CLI entry for npx (`serve`, `test` commands)

### Core Modules

**Authentication (`src/auth/`)**
- `index.ts` - Cookie loading from `MFP_COOKIE` env variable

**MFP Client (`src/client/`)**
- `http.ts` - HTTP client with cookie injection, session validation
- `diary.ts` - Diary/food log scraping from `/food/diary?date=YYYY-MM-DD`
- `goals.ts` - Goals extraction from diary page
- `food-search.ts` - Food database search from `/food/search?search=QUERY`
- `weight.ts` - Weight history from `/weight`
- `summary.ts` - Aggregated nutrition over date range
- `log-food.ts` - Add food entry to diary (requires CSRF handling)

**Types (`src/types/`)**
- `index.ts` - All TypeScript interfaces for diary, meals, nutrition, etc.

**Utils (`src/utils/`)**
- `date.ts` - Date formatting and parsing helpers
- `errors.ts` - Custom error classes (AuthenticationError, SessionExpiredError, etc.)

### MCP Tools

| Tool | Description | Read-only mode |
|------|-------------|----------------|
| `get_diary` | Food diary entries for a date | Yes |
| `get_goals` | User's daily nutrition goals | Yes |
| `search_food` | Search MFP food database | Yes |
| `get_weight_history` | Weight tracking history | Yes |
| `get_nutrition_summary` | Aggregated nutrition over date range | Yes |
| `log_food` | Add food entry to diary | No (disabled in read-only) |

### Read-Only Mode

Start the server with `--read-only` flag to disable write operations:
```bash
node dist/cli.js serve --read-only
```

### Environment Variables

- `MFP_COOKIE` - Required. MyFitnessPal session cookie from browser

### Claude Desktop Configuration

```json
{
  "mcpServers": {
    "myfitnesspal": {
      "command": "npx",
      "args": ["@mcp-collections/myfitnesspal"],
      "env": {
        "MFP_COOKIE": "your_cookie_here"
      }
    }
  }
}
```

## Key Implementation Notes

- All HTML scraping uses Cheerio's `load()` function
- Session validation checks for login page redirects (302 to /account/login)
- The `log_food` tool requires CSRF token extraction from the food item page
- Nutrition summary fetches each day's diary and aggregates (with 200ms delay to avoid rate limiting)
