import type { Bot } from 'mineflayer'
import type { CraftOptions, CraftingPlan, Item } from './types'

type CraftingTable = NonNullable<Parameters<Bot['craft']>[2]>

function getInventoryItems (bot: Bot): Item[] {
  return bot.inventory.slots
    .filter(item => item != null)
    .map(item => ({ id: item.type, count: item.count }))
}

export async function craftPlan (
  bot: Bot,
  plan: CraftingPlan,
  craftingTable: CraftingTable
): Promise<CraftingPlan> {
  if (craftingTable == null) {
    throw new Error('craftingTable is required')
  }

  if (!plan.success) {
    throw new Error('Cannot craft an unsuccessful crafting plan')
  }

  for (const info of plan.recipesToDo) {
    await bot.craft(info.recipe, info.recipeApplications, craftingTable)
  }

  return plan
}

export async function craftItem (
  bot: Bot,
  itemId: number,
  count: number,
  craftingTable: CraftingTable,
  options: CraftOptions = {}
): Promise<CraftingPlan> {
  const availableItems = (options.availableItems ?? getInventoryItems(bot))
    .map(item => ({ ...item }))

  const plan = bot.planCraft({ id: itemId, count }, {
    ...options,
    availableItems,
    careAboutExisting: options.careAboutExisting ?? false,
    includeRecursion: options.includeRecursion ?? true,
    multipleRecipes: options.multipleRecipes ?? true
  })

  await craftPlan(bot, plan, craftingTable)

  return plan
}

export function setupActualCrafting (bot: Bot): void {
  const craftingBot = bot

  craftingBot.craftPlan = async (plan, craftingTable) => {
    return await craftPlan(bot, plan, craftingTable)
  }

  craftingBot.craftItem = async (itemId, count, craftingTable, options) => {
    return await craftItem(craftingBot, itemId, count, craftingTable, options)
  }
}
