import { load } from "cheerio";
import type { MFPHttpClient } from "./http.js";
import type { LogFoodResponse, MealType } from "../types/index.js";
import { getToday } from "../utils/date.js";

const MEAL_MAP: Record<MealType, number> = {
  Breakfast: 0,
  Lunch: 1,
  Dinner: 2,
  Snacks: 3,
};

export async function logFood(
  client: MFPHttpClient,
  foodId: string,
  meal: MealType,
  servings: number = 1,
  date?: string
): Promise<LogFoodResponse> {
  const targetDate = date || getToday();
  const mealIndex = MEAL_MAP[meal];

  try {
    // First, get the food page to find the form details and CSRF token
    const foodPageHtml = await client.get(`/food/item/${foodId}`);
    const $ = load(foodPageHtml);

    // Extract CSRF token
    const csrfToken =
      $('input[name="authenticity_token"]').val() as string ||
      $('meta[name="csrf-token"]').attr("content") ||
      "";

    // Get default serving info
    const servingUnit = $('select[name="serving"] option:selected').text().trim() ||
                        $(".serving-size").text().trim() ||
                        "1 serving";

    // Get food name
    const foodName = $("h1").text().trim() || $(".food-name").text().trim();

    // Submit the form to add food
    const formData: Record<string, string> = {
      authenticity_token: csrfToken,
      food_entry: foodId,
      meal: mealIndex.toString(),
      date: targetDate,
      quantity: servings.toString(),
    };

    await client.post("/food/add_to_diary", formData);

    return {
      success: true,
      entry: {
        id: foodId,
        name: foodName,
        calories: 0, // Would need to parse from the response
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to log food",
    };
  }
}
