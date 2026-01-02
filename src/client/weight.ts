import { load } from "cheerio";
import type { MFPHttpClient } from "./http.js";
import type { WeightHistoryResponse, WeightEntry } from "../types/index.js";

function parseNumber(text: string): number {
  const cleaned = text.replace(/[^0-9.-]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function parseDate(text: string): string {
  // Try to parse various date formats MFP might use
  const date = new Date(text);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split("T")[0];
  }
  return text;
}

export async function getWeightHistory(
  client: MFPHttpClient,
  startDate?: string,
  endDate?: string,
  limit: number = 30
): Promise<WeightHistoryResponse> {
  // MFP has bot protection on some pages - weight may not be accessible
  // Try to get weight data from the user's progress or reports page instead
  let html: string;

  try {
    // Try the reports page which might have weight data
    html = await client.get("/reports/results/progress/default");
  } catch {
    // If reports fails, return empty result
    return {
      entries: [],
      unit: "lb",
    };
  }

  const $ = load(html);

  const entries: WeightEntry[] = [];
  let unit: "kg" | "lb" = "lb"; // Default to lb

  // Detect unit from page
  const unitText = $(".weight-unit, .unit-label").text().toLowerCase();
  if (unitText.includes("kg")) {
    unit = "kg";
  }

  // Try to find weight entries in a table or list
  $("table.weight-table tr, .weight-history tr, .weight-entries li").each((index, element) => {
    if (index >= limit) return false; // Stop after limit

    const $el = $(element);

    // Skip header rows
    if ($el.find("th").length > 0) return;

    const dateCell = $el.find("td:first-child, .date").first();
    const weightCell = $el.find("td:nth-child(2), .weight").first();

    const dateText = dateCell.text().trim();
    const weightText = weightCell.text().trim();

    if (dateText && weightText) {
      entries.push({
        date: parseDate(dateText),
        weight: parseNumber(weightText),
        unit,
      });
    }
  });

  // Try to get current, goal, and start weights
  let current: number | undefined;
  let goal: number | undefined;
  let startWeight: number | undefined;

  const currentText = $(".current-weight, .weight-current").text();
  if (currentText) {
    current = parseNumber(currentText);
  } else if (entries.length > 0) {
    current = entries[0].weight;
  }

  const goalText = $(".goal-weight, .weight-goal").text();
  if (goalText) {
    goal = parseNumber(goalText);
  }

  const startText = $(".start-weight, .weight-start").text();
  if (startText) {
    startWeight = parseNumber(startText);
  } else if (entries.length > 0) {
    startWeight = entries[entries.length - 1].weight;
  }

  return {
    entries,
    current,
    goal,
    startWeight,
    unit,
  };
}
