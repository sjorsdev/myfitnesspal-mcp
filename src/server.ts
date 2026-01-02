import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { getCookieFromEnv, validateCookie } from "./auth/index.js";
import {
  createHttpClient,
  getDiary,
  getGoals,
  searchFood,
  getWeightHistory,
  getNutritionSummary,
  logFood,
  type MFPHttpClient,
} from "./client/index.js";
import { ReadOnlyModeError, AuthenticationError } from "./utils/errors.js";
import type { MealType } from "./types/index.js";

// Input schemas
const GetDiaryInput = z.object({
  date: z.string().optional().describe("Date in YYYY-MM-DD format (defaults to today)"),
});

const GetGoalsInput = z.object({});

const SearchFoodInput = z.object({
  query: z.string().describe("Search term"),
  page: z.number().optional().default(1).describe("Page number (default: 1)"),
});

const GetWeightHistoryInput = z.object({
  startDate: z.string().optional().describe("Start date in YYYY-MM-DD format"),
  endDate: z.string().optional().describe("End date in YYYY-MM-DD format"),
  limit: z.number().optional().default(30).describe("Maximum entries to return (default: 30)"),
});

const GetNutritionSummaryInput = z.object({
  startDate: z.string().describe("Start date in YYYY-MM-DD format"),
  endDate: z.string().describe("End date in YYYY-MM-DD format"),
});

const LogFoodInput = z.object({
  foodId: z.string().describe("Food ID from search results"),
  meal: z.enum(["Breakfast", "Lunch", "Dinner", "Snacks"]).describe("Meal to add food to"),
  servings: z.number().optional().default(1).describe("Number of servings (default: 1)"),
  date: z.string().optional().describe("Date in YYYY-MM-DD format (defaults to today)"),
});

export interface ServerOptions {
  readOnly?: boolean;
}

export async function createServer(options: ServerOptions = {}): Promise<Server> {
  const { readOnly = false } = options;

  const cookie = getCookieFromEnv();
  if (!validateCookie(cookie)) {
    throw new AuthenticationError(
      "MFP_COOKIE environment variable is not set. Please set it with your MyFitnessPal cookie."
    );
  }

  const client = createHttpClient(cookie);

  // Validate session on startup
  const isValid = await client.validateSession();
  if (!isValid) {
    throw new AuthenticationError(
      "Cookie is invalid or session has expired. Please update MFP_COOKIE."
    );
  }

  const server = new Server(
    {
      name: "mcp-myfitnesspal",
      version: "0.0.1",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Define all available tools
  const allTools = [
    {
      name: "get_diary",
      description: "Get food diary entries for a specific date, including meals, nutrition totals, and goals",
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
    {
      name: "get_goals",
      description: "Get user's daily nutrition goals including calories and macros",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "search_food",
      description: "Search the MyFitnessPal food database",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search term",
          },
          page: {
            type: "number",
            description: "Page number (default: 1)",
          },
        },
        required: ["query"],
      },
    },
    {
      name: "get_weight_history",
      description: "Get weight tracking history",
      inputSchema: {
        type: "object",
        properties: {
          startDate: {
            type: "string",
            description: "Start date in YYYY-MM-DD format",
          },
          endDate: {
            type: "string",
            description: "End date in YYYY-MM-DD format",
          },
          limit: {
            type: "number",
            description: "Maximum entries to return (default: 30)",
          },
        },
      },
    },
    {
      name: "get_nutrition_summary",
      description: "Get aggregated nutrition data over a date range with averages and compliance stats",
      inputSchema: {
        type: "object",
        properties: {
          startDate: {
            type: "string",
            description: "Start date in YYYY-MM-DD format",
          },
          endDate: {
            type: "string",
            description: "End date in YYYY-MM-DD format",
          },
        },
        required: ["startDate", "endDate"],
      },
    },
    {
      name: "log_food",
      description: "Add a food entry to the diary",
      inputSchema: {
        type: "object",
        properties: {
          foodId: {
            type: "string",
            description: "Food ID from search results",
          },
          meal: {
            type: "string",
            description: "Meal to add food to: Breakfast, Lunch, Dinner, or Snacks",
          },
          servings: {
            type: "number",
            description: "Number of servings (default: 1)",
          },
          date: {
            type: "string",
            description: "Date in YYYY-MM-DD format (defaults to today)",
          },
        },
        required: ["foodId", "meal"],
      },
    },
  ];

  // Filter out log_food if in read-only mode
  const tools = readOnly
    ? allTools.filter((t) => t.name !== "log_food")
    : allTools;

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case "get_diary": {
          const input = GetDiaryInput.parse(args);
          const result = await getDiary(client, input.date);
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }

        case "get_goals": {
          const result = await getGoals(client);
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }

        case "search_food": {
          const input = SearchFoodInput.parse(args);
          const result = await searchFood(client, input.query, input.page);
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }

        case "get_weight_history": {
          const input = GetWeightHistoryInput.parse(args);
          const result = await getWeightHistory(
            client,
            input.startDate,
            input.endDate,
            input.limit
          );
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }

        case "get_nutrition_summary": {
          const input = GetNutritionSummaryInput.parse(args);
          const result = await getNutritionSummary(
            client,
            input.startDate,
            input.endDate
          );
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }

        case "log_food": {
          if (readOnly) {
            throw new ReadOnlyModeError();
          }
          const input = LogFoodInput.parse(args);
          const result = await logFood(
            client,
            input.foodId,
            input.meal as MealType,
            input.servings,
            input.date
          );
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }

        default:
          return {
            content: [{ type: "text", text: `Unknown tool: ${name}` }],
            isError: true,
          };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text", text: `Error: ${message}` }],
        isError: true,
      };
    }
  });

  return server;
}

export async function runServer(options: ServerOptions = {}): Promise<void> {
  const server = await createServer(options);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
