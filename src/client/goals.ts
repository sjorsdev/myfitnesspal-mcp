import { load } from "cheerio";
import type { MFPHttpClient } from "./http.js";
import type { GoalsResponse } from "../types/index.js";

function parseNumber(text: string): number {
  const cleaned = text.replace(/[^0-9.-]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

export async function getGoals(client: MFPHttpClient): Promise<GoalsResponse> {
  // Get goals from the diary page - look for the "Your Daily Goal" row
  const html = await client.get("/food/diary");
  const $ = load(html);

  let calories = 0;
  let carbsGrams = 0;
  let fatGrams = 0;
  let proteinGrams = 0;

  // Find the goals row - it has "Your Daily Goal" or similar text
  const goalsRow = $("tr.total").filter((_, el) => {
    const label = $(el).find("td.first").text().toLowerCase();
    return label.includes("goal");
  }).first();

  if (goalsRow.length > 0) {
    const cells = goalsRow.find("td");

    // Skip first cell (label), then: calories, carbs, fat, protein, sodium, sugar
    calories = parseNumber($(cells[1]).text());

    // For macros, get only the .macro-value span to avoid including percentage
    carbsGrams = parseNumber($(cells[2]).find(".macro-value").text() || $(cells[2]).text());
    fatGrams = parseNumber($(cells[3]).find(".macro-value").text() || $(cells[3]).text());
    proteinGrams = parseNumber($(cells[4]).find(".macro-value").text() || $(cells[4]).text());
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
