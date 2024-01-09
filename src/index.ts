import { inject } from './craftingInjection'
import type { Item, CraftOptions } from './types'


declare module 'mineflayer' {
  interface Bot {
    planCraft(wantedItem: Item, options: CraftOptions): void
  }
}


export default inject
export const plugin = inject