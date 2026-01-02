import type { MFPHttpClient } from "./http.js";
import type { NutritionSummaryResponse, NutritionTotals } from "../types/index.js";
import { getDiary } from "./diary.js";
import { getGoals } from "./goals.js";
import { getDaysBetween } from "../utils/date.js";

export async function getNutritionSummary(
  client: MFPHttpClient,
  startDate: string,
  endDate: string
): Promise<NutritionSummaryResponse> {
  const days = getDaysBetween(startDate, endDate);
  const goals = await getGoals(client);

  const dailyData: NutritionTotals[] = [];
  let daysLogged = 0;
  let daysUnderGoal = 0;
  let daysOverGoal = 0;

  // Fetch each day's diary
  for (const day of days) {
    try {
      const diary = await getDiary(client, day);

      // Check if any food was logged
      const hasEntries = diary.meals.some((meal) => meal.entries.length > 0);

      if (hasEntries) {
        dailyData.push(diary.totals);
        daysLogged++;

        if (diary.totals.calories < goals.calories) {
          daysUnderGoal++;
        } else {
          daysOverGoal++;
        }
      }

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 200));
    } catch (error) {
      // Skip days that fail to load
      console.error(`Failed to load diary for ${day}:`, error);
    }
  }

  // Calculate averages and totals
  const totals: NutritionTotals = dailyData.reduce(
    (acc, day) => ({
      calories: acc.calories + day.calories,
      carbs: acc.carbs + day.carbs,
      fat: acc.fat + day.fat,
      protein: acc.protein + day.protein,
      sodium: (acc.sodium || 0) + (day.sodium || 0),
      sugar: (acc.sugar || 0) + (day.sugar || 0),
      fiber: (acc.fiber || 0) + (day.fiber || 0),
    }),
    { calories: 0, carbs: 0, fat: 0, protein: 0, sodium: 0, sugar: 0, fiber: 0 }
  );

  const divisor = daysLogged || 1;
  const averages: NutritionTotals = {
    calories: Math.round(totals.calories / divisor),
    carbs: Math.round(totals.carbs / divisor),
    fat: Math.round(totals.fat / divisor),
    protein: Math.round(totals.protein / divisor),
    sodium: Math.round((totals.sodium || 0) / divisor),
    sugar: Math.round((totals.sugar || 0) / divisor),
    fiber: Math.round((totals.fiber || 0) / divisor),
  };

  return {
    period: { start: startDate, end: endDate },
    days: days.length,
    averages,
    totals,
    compliance: {
      daysLogged,
      daysUnderGoal,
      daysOverGoal,
    },
  };
}
