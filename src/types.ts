import type { Recipe } from 'prismarine-recipe'

export interface Item { id: number, count: number }

export interface CraftOptions {
  includeRecursion?: boolean
  multipleRecipes?: boolean
  careAboutExisting?: boolean
  availableItems?: Item[]
}

export interface RecipeInfo {
  recipe: Recipe
  recipeApplications: number

}

export type CraftingPlanStatus = 'complete' | 'partial_complete' | 'failure' | 'unknown'

export interface CraftingPlan {
  status: CraftingPlanStatus
  itemsRequiredBase: Item[]
  itemsRequiredImmediate: Item[]
  itemsRemaining: Item[]
  itemsCreated: Item[]
  recipesToDo: RecipeInfo[]
  requiresCraftingTable: boolean
}
