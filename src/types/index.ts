export interface NutritionTotals {
  calories: number;
  carbs: number;
  fat: number;
  protein: number;
  sodium?: number;
  sugar?: number;
  fiber?: number;
  saturatedFat?: number;
  cholesterol?: number;
}

export interface DiaryEntry {
  name: string;
  brand?: string;
  amount: string;
  calories: number;
  carbs: number;
  fat: number;
  protein: number;
  sodium?: number;
  sugar?: number;
  fiber?: number;
}

export interface Meal {
  name: string;
  entries: DiaryEntry[];
  totals: NutritionTotals;
}

export interface DiaryResponse {
  date: string;
  meals: Meal[];
  totals: NutritionTotals;
  goals: NutritionTotals;
  remaining: NutritionTotals;
  water?: {
    cups: number;
    goal: number;
  };
}

export interface GoalsResponse {
  calories: number;
  carbs: { grams: number; percentage: number };
  fat: { grams: number; percentage: number };
  protein: { grams: number; percentage: number };
  sodium?: number;
  sugar?: number;
  fiber?: number;
}

export interface FoodSearchResult {
  id: string;
  name: string;
  brand?: string;
  calories: number;
  servingSize: string;
  verified: boolean;
}

export interface FoodSearchResponse {
  results: FoodSearchResult[];
  totalResults: number;
  page: number;
  hasMore: boolean;
}

export interface WeightEntry {
  date: string;
  weight: number;
  unit: "kg" | "lb";
}

export interface WeightHistoryResponse {
  entries: WeightEntry[];
  current?: number;
  goal?: number;
  startWeight?: number;
  unit: "kg" | "lb";
}

export interface NutritionSummaryResponse {
  period: { start: string; end: string };
  days: number;
  averages: NutritionTotals;
  totals: NutritionTotals;
  compliance: {
    daysLogged: number;
    daysUnderGoal: number;
    daysOverGoal: number;
  };
}

export interface LogFoodResponse {
  success: boolean;
  entry?: {
    id: string;
    name: string;
    calories: number;
  };
  error?: string;
}

export type MealType = "Breakfast" | "Lunch" | "Dinner" | "Snacks";
