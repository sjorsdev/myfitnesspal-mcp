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

  // Parse search results - MFP uses a list or table format
  $(".food-search-results li, .search-results tr, ul.results li").each((_, element) => {
    const $el = $(element);

    // Try different selectors for the food link/name
    const foodLink = $el.find("a.food-link, a[href*='/food/item'], .food-title a").first();
    if (foodLink.length === 0) return;

    const href = foodLink.attr("href") || "";
    const idMatch = href.match(/\/food\/(?:item|calorie-chart)\/(\d+)/);
    const id = idMatch ? idMatch[1] : "";

    if (!id) return;

    const fullName = foodLink.text().trim();

    // Parse brand and name
    let name = fullName;
    let brand: string | undefined;

    if (fullName.includes(" - ")) {
      const parts = fullName.split(" - ");
      brand = parts[0].trim();
      name = parts.slice(1).join(" - ").trim();
    }

    // Get nutritional info and serving size
    const nutritionText = $el.find(".nutritional-info, .nutrition, .calories").text();
    const calories = parseNumber(nutritionText) || 0;

    const servingText = $el.find(".serving-size, .serving, .portion").text().trim();
    const servingSize = servingText || "1 serving";

    // Check for verified badge
    const verified = $el.find(".verified, .checkmark, svg.verified").length > 0;

    results.push({
      id,
      name,
      brand,
      calories,
      servingSize,
      verified,
    });
  });

  // Check for pagination
  const totalResultsText = $(".total-results, .results-count").text();
  const totalResults = parseNumber(totalResultsText) || results.length;

  const hasNextPage = $("a.next, .pagination .next, a[rel='next']").length > 0;

  return {
    results,
    totalResults,
    page,
    hasMore: hasNextPage,
  };
}
