import { load } from "cheerio";
import type { MFPHttpClient } from "./http.js";
import type { FoodSearchResponse, FoodSearchResult } from "../types/index.js";

function parseNumber(text: string): number {
  const cleaned = text.replace(/[^0-9.-]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

export async function searchFood(
  client: MFPHttpClient,
  query: string,
  page: number = 1
): Promise<FoodSearchResponse> {
  const encodedQuery = encodeURIComponent(query);
  const html = await client.get(`/food/search?search=${encodedQuery}&page=${page}`);
  const $ = load(html);

  const results: FoodSearchResult[] = [];

  // MFP uses li.matched-food for search results
  $("li.matched-food").each((_, element) => {
    const $el = $(element);

    // Get the food link - contains ID and name
    const foodLink = $el.find("a").first();
    const href = foodLink.attr("href") || "";

    // Extract ID from href like /food/calories-nutrition/generic/banana
    const idMatch = href.match(/\/food\/[^/]+\/([^/?]+)/);
    const id = idMatch ? idMatch[1] : "";

    if (!id) return;

    // Get the food name and details
    const title = $el.find(".food-title, .title").text().trim() || foodLink.text().trim();
    const nutritionInfo = $el.find(".nutritional-info, .nutrition").text().trim();

    // Parse name - sometimes includes "Brand - Name"
    let name = title;
    let brand: string | undefined;

    if (title.includes(" - ")) {
      const parts = title.split(" - ");
      brand = parts[0].trim();
      name = parts.slice(1).join(" - ").trim();
    }

    // Parse calories from nutrition info
    const caloriesMatch = nutritionInfo.match(/(\d+)\s*cal/i);
    const calories = caloriesMatch ? parseInt(caloriesMatch[1]) : 0;

    // Get serving size
    const servingSize = $el.find(".serving-size, .serving").text().trim() ||
                        nutritionInfo.replace(/\d+\s*cal.*/i, "").trim() ||
                        "1 serving";

    // Check for verified badge
    const verified = $el.find(".verified, .checkmark, .mfp-verified").length > 0;

    results.push({
      id,
      name: name || title,
      brand,
      calories,
      servingSize,
      verified,
    });
  });

  // Check for pagination
  const hasNextPage = $("a.next, .pagination .next, a[rel='next']").length > 0;

  return {
    results,
    totalResults: results.length,
    page,
    hasMore: hasNextPage,
  };
}
