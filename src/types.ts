import type { Recipe } from 'prismarine-recipe'

export interface Item { id: number, count: number }

export interface CraftOptions {
  includeRecursion?: boolean
  multipleRecipes?: boolean
  availableItems?: Item[]
}

export interface RecipeInfo {
  recipe: Recipe
  recipeApplications: number

}

export interface CraftingPlan {
  success: boolean
  itemsRequired: Item[]
  recipesToDo: RecipeInfo[]
  requiresCraftingTable: boolean
}
