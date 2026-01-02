import { load } from "cheerio";
import type { MFPHttpClient } from "./http.js";
import type { DiaryResponse, Meal, DiaryEntry, NutritionTotals } from "../types/index.js";
import { ParseError } from "../utils/errors.js";
import { getToday } from "../utils/date.js";

type $ = ReturnType<typeof load>;

function parseNumber(text: string): number {
  const cleaned = text.replace(/[^0-9.-]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function parseNutritionRow($: $, row: Parameters<$>[0]): NutritionTotals {
  const cells = $(row).find("td");
  return {
    calories: parseNumber($(cells[0]).text()),
    carbs: parseNumber($(cells[1]).text()),
    fat: parseNumber($(cells[2]).text()),
    protein: parseNumber($(cells[3]).text()),
    sodium: parseNumber($(cells[4]).text()),
    sugar: parseNumber($(cells[5]).text()),
  };
}

function parseDiaryEntry($: $, row: Parameters<$>[0]): DiaryEntry | null {
  const nameCell = $(row).find("td.first");
  if (nameCell.length === 0) return null;

  const nameLink = nameCell.find("a");
  const fullName = nameLink.text().trim() || nameCell.text().trim();

  // Try to separate brand from name (format: "Brand - Name" or "Name, Brand")
  let name = fullName;
  let brand: string | undefined;

  if (fullName.includes(" - ")) {
    const parts = fullName.split(" - ");
    brand = parts[0].trim();
    name = parts.slice(1).join(" - ").trim();
  }

  const cells = $(row).find("td:not(.first)");
  const amount = $(cells[0]).text().trim();

  return {
    name,
    brand,
    amount,
    calories: parseNumber($(cells[1]).text()),
    carbs: parseNumber($(cells[2]).text()),
    fat: parseNumber($(cells[3]).text()),
    protein: parseNumber($(cells[4]).text()),
    sodium: parseNumber($(cells[5]).text()),
    sugar: parseNumber($(cells[6]).text()),
  };
}

export async function getDiary(
  client: MFPHttpClient,
  date?: string
): Promise<DiaryResponse> {
  const targetDate = date || getToday();
  const html = await client.get(`/food/diary?date=${targetDate}`);
  const $ = load(html);

  const meals: Meal[] = [];
  const mealNames = ["Breakfast", "Lunch", "Dinner", "Snacks"];

  // Find meal sections
  for (const mealName of mealNames) {
    const mealHeader = $(`tr.meal_row:contains("${mealName}")`).first();
    if (mealHeader.length === 0) continue;

    const entries: DiaryEntry[] = [];
    let currentRow = mealHeader.next();

    // Collect entries until we hit the totals or next meal
    while (currentRow.length > 0) {
      if (currentRow.hasClass("meal_row") || currentRow.hasClass("total")) {
        break;
      }

      if (currentRow.hasClass("bottom") || currentRow.find("td.first a").length > 0) {
        const entry = parseDiaryEntry($, currentRow[0]);
        if (entry) {
          entries.push(entry);
        }
      }

      currentRow = currentRow.next();
    }

    // Get meal totals from the meal row itself or calculate
    const totals: NutritionTotals = entries.reduce(
      (acc, entry) => ({
        calories: acc.calories + entry.calories,
        carbs: acc.carbs + entry.carbs,
        fat: acc.fat + entry.fat,
        protein: acc.protein + entry.protein,
        sodium: (acc.sodium || 0) + (entry.sodium || 0),
        sugar: (acc.sugar || 0) + (entry.sugar || 0),
      }),
      { calories: 0, carbs: 0, fat: 0, protein: 0, sodium: 0, sugar: 0 }
    );

    meals.push({
      name: mealName,
      entries,
      totals,
    });
  }

  // Parse totals row
  const totalsRow = $("tr.total").first();
  const goalsRow = $("tr.total").eq(1);
  const remainingRow = $("tr.total").eq(2);

  const totals = totalsRow.length
    ? parseNutritionRow($, totalsRow[0])
    : { calories: 0, carbs: 0, fat: 0, protein: 0 };

  const goals = goalsRow.length
    ? parseNutritionRow($, goalsRow[0])
    : { calories: 0, carbs: 0, fat: 0, protein: 0 };

  const remaining = remainingRow.length
    ? parseNutritionRow($, remainingRow[0])
    : { calories: 0, carbs: 0, fat: 0, protein: 0 };

  // Try to find water tracking
  let water: { cups: number; goal: number } | undefined;
  const waterSection = $(".water-counter");
  if (waterSection.length > 0) {
    const cupsText = waterSection.find(".cups").text();
    const goalText = waterSection.find(".goal").text();
    water = {
      cups: parseNumber(cupsText),
      goal: parseNumber(goalText),
    };
  }

  return {
    date: targetDate,
    meals,
    totals,
    goals,
    remaining,
    water,
  };
}
