import { inject } from './craftingInjection'
import type { Item, CraftOptions, CraftingPlan } from './types'


declare module 'mineflayer' {
  interface Bot {
    planCraft(wantedItem: Item, options?: CraftOptions): CraftingPlan
    planCraftInventory(wantedItem: Item): CraftingPlan;
  }
}


export default inject
export const plugin = inject