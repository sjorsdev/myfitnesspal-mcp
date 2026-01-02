import { load } from "cheerio";
import type { MFPHttpClient } from "./http.js";
import type { GoalsResponse } from "../types/index.js";

function parseNumber(text: string): number {
  const cleaned = text.replace(/[^0-9.-]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

export async function getGoals(client: MFPHttpClient): Promise<GoalsResponse> {
  // First try to get goals from the diary page (often more accessible)
  const html = await client.get("/food/diary");
  const $ = load(html);

  // Look for the goals row in the diary table
  const goalsRow = $("tr.total").filter((_, el) => {
    return $(el).text().toLowerCase().includes("goal") ||
           $(el).find("td").first().text().toLowerCase().includes("goal");
  }).first();

  let calories = 0;
  let carbsGrams = 0;
  let fatGrams = 0;
  let proteinGrams = 0;

  if (goalsRow.length > 0) {
    const cells = goalsRow.find("td");
    // Skip the label cell
    calories = parseNumber($(cells[1]).text() || $(cells[0]).text());
    carbsGrams = parseNumber($(cells[2]).text() || $(cells[1]).text());
    fatGrams = parseNumber($(cells[3]).text() || $(cells[2]).text());
    proteinGrams = parseNumber($(cells[4]).text() || $(cells[3]).text());
  }

  // If we couldn't find goals in diary, try the goals page
  if (calories === 0) {
    const goalsHtml = await client.get("/account/my-goals");
    const $goals = load(goalsHtml);

    // Try to parse from the goals page structure
    const calorieGoal = $goals('*:contains("Calories")').closest("tr").find("td").last();
    if (calorieGoal.length) {
      calories = parseNumber(calorieGoal.text());
    }
  }

  // Calculate macro percentages based on calories
  // Carbs: 4 cal/g, Fat: 9 cal/g, Protein: 4 cal/g
  const totalMacroCals = (carbsGrams * 4) + (fatGrams * 9) + (proteinGrams * 4);

  return {
    calories,
    carbs: {
      grams: carbsGrams,
      percentage: totalMacroCals > 0 ? Math.round((carbsGrams * 4 / totalMacroCals) * 100) : 0,
    },
    fat: {
      grams: fatGrams,
      percentage: totalMacroCals > 0 ? Math.round((fatGrams * 9 / totalMacroCals) * 100) : 0,
    },
    protein: {
      grams: proteinGrams,
      percentage: totalMacroCals > 0 ? Math.round((proteinGrams * 4 / totalMacroCals) * 100) : 0,
    },
  };
}
