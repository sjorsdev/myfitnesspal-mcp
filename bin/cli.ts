import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { Command } from "commander";
import { runServer } from "../src/server.js";
import { getCookieFromEnv, validateCookie } from "../src/auth/index.js";
import { createHttpClient, getDiary, getGoals } from "../src/client/index.js";

// Load .env file if it exists
function loadEnv() {
  const envPath = join(process.cwd(), ".env");
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex);
      let value = trimmed.slice(eqIndex + 1);
      // Remove surrounding quotes
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
}

loadEnv();

const program = new Command();

program
  .name("mcp-myfitnesspal")
  .description("MyFitnessPal MCP Server")
  .version("0.0.1");

program
  .command("serve", { isDefault: true })
  .description("Start the MCP server")
  .option("--read-only", "Run in read-only mode (disable write operations)")
  .action(async (options) => {
    try {
      await runServer({ readOnly: options.readOnly });
    } catch (error) {
      console.error("Failed to start server:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command("test")
  .description("Test the connection and fetch today's diary")
  .action(async () => {
    const cookie = getCookieFromEnv();

    if (!validateCookie(cookie)) {
      console.error("Error: MFP_COOKIE environment variable is not set.");
      console.error("Set it with: export MFP_COOKIE='your_cookie_here'");
      process.exit(1);
    }

    console.log("Testing connection...");
    const client = createHttpClient(cookie);

    try {
      const isValid = await client.validateSession();
      if (!isValid) {
        console.error("Session is invalid or expired. Please update your MFP_COOKIE.");
        process.exit(1);
      }
      console.log("✓ Session is valid\n");

      console.log("Fetching today's diary...");
      const diary = await getDiary(client);
      console.log(`✓ Date: ${diary.date}`);
      console.log(`✓ Total calories: ${diary.totals.calories}`);
      console.log(`✓ Goal: ${diary.goals.calories}`);
      console.log(`✓ Remaining: ${diary.remaining.calories}\n`);

      console.log("Meals:");
      for (const meal of diary.meals) {
        console.log(`  ${meal.name}: ${meal.entries.length} entries, ${meal.totals.calories} cal`);
      }

      console.log("\nFetching goals...");
      const goals = await getGoals(client);
      console.log(`✓ Daily calorie goal: ${goals.calories}`);
      console.log(`✓ Carbs: ${goals.carbs.grams}g (${goals.carbs.percentage}%)`);
      console.log(`✓ Fat: ${goals.fat.grams}g (${goals.fat.percentage}%)`);
      console.log(`✓ Protein: ${goals.protein.grams}g (${goals.protein.percentage}%)`);

      console.log("\n✓ All tests passed!");
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse();
