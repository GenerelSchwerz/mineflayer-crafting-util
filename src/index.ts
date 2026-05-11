import type { Bot, BotOptions } from 'mineflayer'
import { _build } from './craft-injection'
import { setupActualCrafting, type CraftPlanOptions } from './actual-crafting'
import type { Item, CraftOptions, CraftingPlan } from './types'
import { type Recipe as PRecipe } from 'prismarine-recipe'

type CraftingTable = NonNullable<Parameters<Bot['craft']>[2]>

declare module 'mineflayer' {
  interface Bot {
    planCraft: (wantedItem: Item, options?: CraftOptions) => CraftingPlan
    planCraftInventory: (wantedItem: Item) => CraftingPlan
    craftPlan: (plan: CraftingPlan, craftingTable: CraftingTable, options?: CraftPlanOptions) => Promise<CraftingPlan>
    craftItem: (itemId: number, count: number, craftingTable: CraftingTable, options?: CraftOptions, craftOptions?: CraftPlanOptions) => Promise<CraftingPlan>
  }
}

function injectCraftingFromRecipeInstance (
  bot: Bot,
  Recipe: typeof PRecipe
): void {
  const newCraft = _build(Recipe)

  bot.planCraft = newCraft

  bot.planCraftInventory = function craftWithInventory (wantedItem: Item): CraftingPlan {
    const items = bot.inventory.slots
      .filter((i): i is NonNullable<typeof i> => i != null)
      .map(i => {
        return {
          id: i.type,
          count: i.count
        }
      })

    return newCraft(wantedItem, {
      availableItems: items,
      careAboutExisting: false,
      includeRecursion: true,
      multipleRecipes: true
    })
  }

  setupActualCrafting(bot)
}

const createPlugin = (recipe?: typeof import('prismarine-recipe').Recipe) => {
  return async (bot: Bot, botoptions: BotOptions): Promise<void> => {
    if (recipe != null) {
      injectCraftingFromRecipeInstance(bot, recipe)
    } else {
      const prismarineRecipe = (await import('prismarine-recipe')).default
      // @ts-expect-error prismarine-recipe's default export is not typed cleanly here
      const recipeInstance = prismarineRecipe(bot.registry)
      injectCraftingFromRecipeInstance(bot, recipeInstance.Recipe)
    }
  }
}

export default createPlugin
export { buildStatic } from './craft-injection'
export { createPlugin as plugin }
export { injectCraftingFromRecipeInstance }
export { craftItem, craftPlan, setupActualCrafting } from './actual-crafting'
