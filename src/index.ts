import type { Bot, BotOptions } from 'mineflayer'
import { _build } from './craft-injection'
import { setupActualCrafting, type CraftPlanOptions } from './actual-crafting'
import type { Item, CraftOptions, CraftingPlan } from './types'

type CraftingTable = NonNullable<Parameters<Bot['craft']>[2]>

declare module 'mineflayer' {
  interface Bot {
    planCraft: (wantedItem: Item, options?: CraftOptions) => CraftingPlan
    planCraftInventory: (wantedItem: Item) => CraftingPlan
    craftPlan: (plan: CraftingPlan, craftingTable: CraftingTable, options?: CraftPlanOptions) => Promise<CraftingPlan>
    craftItem: (itemId: number, count: number, craftingTable: CraftingTable, options?: CraftOptions, craftOptions?: CraftPlanOptions) => Promise<CraftingPlan>
  }
}

async function injectBot (bot: Bot, botoptions: BotOptions): Promise<void> {
  // @ts-expect-error
  const Recipe = (await import('prismarine-recipe')).default(bot.registry).Recipe
  const newCraft = _build(Recipe)

  bot.planCraft = newCraft

  function craftWithInventory (wantedItem: Item): CraftingPlan {
    const items = bot.inventory.slots.filter(i => !(i == null)).map(i => { return { id: i.type, count: i.count } })
    return newCraft(wantedItem, {
      availableItems: items,
      careAboutExisting: false,
      includeRecursion: true,
      multipleRecipes: true
    })
  }

  bot.planCraftInventory = craftWithInventory
  setupActualCrafting(bot)
}

export default injectBot
export { buildStatic } from './craft-injection'
export { injectBot as plugin }
export { craftItem, craftPlan, setupActualCrafting } from './actual-crafting'
