import { load } from "cheerio";
import type { MFPHttpClient } from "./http.js";
import type { DiaryResponse, Meal, DiaryEntry, NutritionTotals } from "../types/index.js";
import { getToday } from "../utils/date.js";

type $ = ReturnType<typeof load>;

function parseNumber(text: string): number {
  const cleaned = text.replace(/[^0-9.-]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function parseTotalsRow($: $, row: Parameters<$>[0]): NutritionTotals {
  const $row = $(row);
  const cells = $row.find("td");

  // Skip first cell (label), then:
  // calories (plain text), carbs/fat/protein (have .macro-value), sodium, sugar
  const calories = parseNumber($(cells[1]).text());

  // For macros, get only the .macro-value span to avoid including percentage
  const carbs = parseNumber($(cells[2]).find(".macro-value").text() || $(cells[2]).text());
  const fat = parseNumber($(cells[3]).find(".macro-value").text() || $(cells[3]).text());
  const protein = parseNumber($(cells[4]).find(".macro-value").text() || $(cells[4]).text());

  const sodium = parseNumber($(cells[5]).text());
  const sugar = parseNumber($(cells[6]).text());

  return { calories, carbs, fat, protein, sodium, sugar };
}

function parseDiaryEntry($: $, row: Parameters<$>[0]): DiaryEntry | null {
  const $row = $(row);
  const cells = $row.find("td");
  if (cells.length < 7) return null;

  // Cell 0: name (with amount included, e.g., "Eggs, boiled, 2 medium")
  const nameCell = $(cells[0]);
  const fullName = nameCell.text().trim();
  if (!fullName || fullName.includes("Add Food") || fullName.includes("Quick Tools")) return null;

  // Try to extract amount from name - usually after last comma
  let name = fullName;
  let amount = "";
  let brand: string | undefined;

  // Check for "Brand - Name, amount" format
  if (fullName.includes(" - ")) {
    const parts = fullName.split(" - ");
    brand = parts[0].trim();
    const rest = parts.slice(1).join(" - ").trim();
    // Try to find amount after last comma
    const lastComma = rest.lastIndexOf(",");
    if (lastComma > -1) {
      name = rest.substring(0, lastComma).trim();
      amount = rest.substring(lastComma + 1).trim();
    } else {
      name = rest;
    }
  } else {
    // Try to find amount after last comma
    const lastComma = fullName.lastIndexOf(",");
    if (lastComma > -1) {
      name = fullName.substring(0, lastComma).trim();
      amount = fullName.substring(lastComma + 1).trim();
    }
  }

  // Cell structure: name, calories, carbs, fat, protein, sodium, sugar, delete
  return {
    name,
    brand,
    amount,
    calories: parseNumber($(cells[1]).text()),
    carbs: parseNumber($(cells[2]).find(".macro-value").text() || $(cells[2]).text()),
    fat: parseNumber($(cells[3]).find(".macro-value").text() || $(cells[3]).text()),
    protein: parseNumber($(cells[4]).find(".macro-value").text() || $(cells[4]).text()),
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

  // Find meal sections - they use meal_header class
  for (const mealName of mealNames) {
    const mealHeader = $(`tr.meal_header:contains("${mealName}")`).first();
    if (mealHeader.length === 0) continue;

    const entries: DiaryEntry[] = [];
    let currentRow = mealHeader.next();

    // Collect entries until we hit the totals or next meal header
    while (currentRow.length > 0) {
      if (currentRow.hasClass("meal_header") || currentRow.hasClass("total")) {
        break;
      }

      // Food entries have class "bottom" or contain a link in td.first
      if (currentRow.hasClass("bottom") || currentRow.find("td.first a").length > 0) {
        const entry = parseDiaryEntry($, currentRow[0]);
        if (entry && entry.name) {
          entries.push(entry);
        }
      }

      currentRow = currentRow.next();
    }

    // Calculate meal totals from entries
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

  // Parse summary rows at the bottom
  // Order: Totals, Your Daily Goal, Remaining
  const totalRows = $("tr.total");

  let totals: NutritionTotals = { calories: 0, carbs: 0, fat: 0, protein: 0 };
  let goals: NutritionTotals = { calories: 0, carbs: 0, fat: 0, protein: 0 };
  let remaining: NutritionTotals = { calories: 0, carbs: 0, fat: 0, protein: 0 };

  totalRows.each((i, row) => {
    const label = $(row).find("td.first").text().trim().toLowerCase();
    if (label.includes("total") && !label.includes("goal") && !label.includes("remaining")) {
      totals = parseTotalsRow($, row);
    } else if (label.includes("goal")) {
      goals = parseTotalsRow($, row);
    } else if (label.includes("remaining")) {
      remaining = parseTotalsRow($, row);
    }
  });

  // Try to find water tracking
  let water: { cups: number; goal: number } | undefined;
  const waterSection = $(".water-counter, #water-cups");
  if (waterSection.length > 0) {
    const cupsText = waterSection.find(".cups, .water-consumed").text();
    const goalText = waterSection.find(".goal, .water-goal").text();
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
