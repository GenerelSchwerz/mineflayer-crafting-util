import type { Bot } from 'mineflayer'
import type { CraftOptions, CraftingPlan, Item } from './types'

type CraftingTable = NonNullable<Parameters<Bot['craft']>[2]>

export interface CraftPlanOptions {
  strict?: boolean
}

function getInventoryItems (bot: Bot): Item[] {
  return bot.inventory.slots
    .filter(item => item != null)
    .map(item => ({ id: item.type, count: item.count }))
}

function splitApplications (applications: number, stackSize: number): number[] {
  if (stackSize <= 0 || applications <= stackSize) return [applications]

  const chunks: number[] = []
  let remaining = applications

  while (remaining > 0) {
    const count = Math.min(remaining, stackSize)
    chunks.push(count)
    remaining -= count
  }

  return chunks
}

export async function craftPlan (
  bot: Bot,
  plan: CraftingPlan,
  craftingTable: CraftingTable,
  options: CraftPlanOptions = {}
): Promise<CraftingPlan> {
  if (craftingTable == null) {
    throw new Error('craftingTable is required')
  }

  if (!plan.success) {
    throw new Error('Cannot craft an unsuccessful crafting plan')
  }
  // it is so dumb that I have to support this but whatever.
  for (const info of plan.recipesToDo) {
    const stackSize = bot.registry.items[info.recipe.result.id]?.stackSize ?? info.recipeApplications
    const applicationCounts = options.strict === true
      ? splitApplications(info.recipeApplications, stackSize)
      : [info.recipeApplications]

    for (const applicationCount of applicationCounts) {
      // console.log(`crafting ${bot.registry.items[info.recipe.result.id].name} x ${applicationCount}`)
      await bot.craft(info.recipe, applicationCount, craftingTable)

      // console.log(bot.inventory.slots.filter(i => !!i).map(i => [i.name, i.count, i.stackSize]))
    }
  }

  return plan
}

export async function craftItem (
  bot: Bot,
  itemId: number,
  count: number,
  craftingTable: CraftingTable,
  options: CraftOptions = {},
  craftOptions: CraftPlanOptions = {}
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

  await craftPlan(bot, plan, craftingTable, craftOptions)

  return plan
}

export function setupActualCrafting (bot: Bot): void {
  const craftingBot = bot

  craftingBot.craftPlan = async (plan, craftingTable, options) => {
    return await craftPlan(bot, plan, craftingTable, options)
  }

  craftingBot.craftItem = async (itemId, count, craftingTable, options, craftOptions) => {
    return await craftItem(craftingBot, itemId, count, craftingTable, options, craftOptions)
  }
}
