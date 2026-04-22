# mineflayer-crafting-util

Crafting planner and execution helpers for Mineflayer bots.

The library can be used in two ways:

- As a Mineflayer plugin, which adds planning and crafting methods to `bot`.
- As a static planner, which builds plans from a `minecraft-data` registry without connecting a bot.

## Installation

```sh
npm i mineflayer-crafting-util
```

```sh
yarn add mineflayer-crafting-util
```

## Bot Usage

```js
const mineflayer = require('mineflayer')
const { plugin: craftingUtil } = require('mineflayer-crafting-util')

const bot = mineflayer.createBot({
  host: 'localhost',
  port: 25565,
  username: 'bot'
})

bot.loadPlugin(craftingUtil)

bot.once('spawn', async () => {
  const stick = bot.registry.itemsByName.stick
  const craftingTable = bot.findBlock({
    matching: bot.registry.blocksByName.crafting_table.id,
    maxDistance: 4
  })

  const plan = bot.planCraftInventory({ id: stick.id, count: 4 })

  if (!plan.success) {
    console.log('Missing:', plan.itemsRequired)
    return
  }

  await bot.craftPlan(plan, craftingTable)
})
```

For a one-call inventory-backed craft:

```js
const pickaxe = bot.registry.itemsByName.iron_pickaxe
const craftingTable = bot.findBlock({
  matching: bot.registry.blocksByName.crafting_table.id,
  maxDistance: 4
})

await bot.craftItem(pickaxe.id, 1, craftingTable)
```

## Static Usage

```js
const mcData = require('minecraft-data')('1.21.4')
const { buildStatic } = require('mineflayer-crafting-util')

async function main () {
  const crafter = await buildStatic(mcData)
  const pickaxe = mcData.itemsByName.stone_pickaxe

  const plan = crafter(
    { id: pickaxe.id, count: 1 },
    {
      availableItems: [
        { id: mcData.itemsByName.cobblestone.id, count: 3 },
        { id: mcData.itemsByName.oak_log.id, count: 1 }
      ],
      multipleRecipes: true
    }
  )

  console.log(plan.success)
  console.log(plan.recipesToDo)
}

main()
```

## Exports

### `plugin`

```ts
plugin(bot: Bot, botOptions: BotOptions): Promise<void>
```

Mineflayer plugin export. Use with `bot.loadPlugin(plugin)`.

The default export is the same plugin:

```js
const craftingUtil = require('mineflayer-crafting-util')
bot.loadPlugin(craftingUtil.default ?? craftingUtil.plugin)
```

### `buildStatic`

```ts
buildStatic(registry: IndexedData): Promise<CraftingFunc>
```

Builds a version-specific planner from a `minecraft-data` registry.

```js
const mcData = require('minecraft-data')('1.21.4')
const crafter = await buildStatic(mcData)
const plan = crafter({ id: mcData.itemsByName.stick.id, count: 4 })
```

### `craftPlan`

```ts
craftPlan(
  bot: Bot,
  plan: CraftingPlan,
  craftingTable: Block,
  options?: CraftPlanOptions
): Promise<CraftingPlan>
```

Executes every recipe step in an existing plan with `bot.craft`.

Rules:

- `craftingTable` is required.
- Throws if `plan.success` is false.
- Returns the same plan after crafting.
- By default, each plan step is sent to Mineflayer as one `bot.craft(recipe, recipeApplications, craftingTable)` call.
- With `{ strict: true }`, large recipe application counts are split by the crafted item stack size.

### `craftItem`

```ts
craftItem(
  bot: Bot,
  itemId: number,
  count: number,
  craftingTable: Block,
  options?: CraftOptions,
  craftOptions?: CraftPlanOptions
): Promise<CraftingPlan>
```

Plans and executes a craft for `itemId`.

Defaults used by `craftItem`:

- `availableItems`: current bot inventory, unless provided.
- `careAboutExisting`: `false`.
- `includeRecursion`: `true`.
- `multipleRecipes`: `true`.

### `setupActualCrafting`

```ts
setupActualCrafting(bot: Bot): void
```

Adds `bot.craftPlan` and `bot.craftItem` to a bot. The plugin calls this automatically, so most users do not need to call it directly.

## Bot Methods

Loading the plugin adds these methods to `bot`.

### `bot.planCraft`

```ts
bot.planCraft(wantedItem: Item, options?: CraftOptions): CraftingPlan
```

Creates a crafting plan for `wantedItem`.

Without `availableItems`, this answers "what would be required to craft this?" and does not validate against a specific inventory.

With `availableItems`, this answers "can this be crafted from these items?" and returns a concrete ordered recipe plan when possible.

### `bot.planCraftInventory`

```ts
bot.planCraftInventory(wantedItem: Item): CraftingPlan
```

Plans using the bot inventory as `availableItems`.

Internally this uses:

```ts
{
  availableItems: bot inventory items,
  careAboutExisting: false,
  includeRecursion: true,
  multipleRecipes: true
}
```

### `bot.craftPlan`

```ts
bot.craftPlan(
  plan: CraftingPlan,
  craftingTable: Block,
  options?: CraftPlanOptions
): Promise<CraftingPlan>
```

Executes an existing plan. This is the bot-bound wrapper around the exported `craftPlan`.

### `bot.craftItem`

```ts
bot.craftItem(
  itemId: number,
  count: number,
  craftingTable: Block,
  options?: CraftOptions,
  craftOptions?: CraftPlanOptions
): Promise<CraftingPlan>
```

Plans from inventory and executes the result. This is the bot-bound wrapper around the exported `craftItem`.

## Types

### `Item`

```ts
interface Item {
  id: number
  count: number
}
```

`id` is the numeric item id from the active Minecraft registry. `count` is the item count.

### `CraftOptions`

```ts
interface CraftOptions {
  availableItems?: Item[]
  careAboutExisting?: boolean
  includeRecursion?: boolean
  multipleRecipes?: boolean
}
```

| Option | Default | Description |
| --- | --- | --- |
| `availableItems` | `undefined` | Inventory constraints for the planner. When provided, the planner attempts to produce a craftable ordered plan from those items. |
| `careAboutExisting` | `false` | When `false`, matching copies of the wanted item inside `availableItems` are ignored so the planner crafts the requested count fresh. When `true`, existing wanted items can satisfy the request. |
| `includeRecursion` | `false` | Keeps recursive planning behavior enabled for inventory-backed plans. `bot.planCraftInventory` and `craftItem` enable this. |
| `multipleRecipes` | `false` | Allows the planner to try alternate recipes and recipe families when building a plan from available items. Recommended with `availableItems`. |

Note: `availableItems` may be normalized by the planner. Pass a cloned array if you need to preserve the original object identities and counts.

### `CraftingPlan`

```ts
interface CraftingPlan {
  success: boolean
  itemsRequired: Item[]
  recipesToDo: RecipeInfo[]
  requiresCraftingTable: boolean
}
```

| Property | Description |
| --- | --- |
| `success` | Whether the planner found a valid plan. |
| `itemsRequired` | Missing base items or remaining requirements. For successful available-item plans, positive counts should usually be empty. |
| `recipesToDo` | Ordered recipe applications to execute. |
| `requiresCraftingTable` | Whether any step in `recipesToDo` requires a crafting table. |

### `RecipeInfo`

```ts
interface RecipeInfo {
  recipe: Recipe
  recipeApplications: number
}
```

`recipe` is a `prismarine-recipe` recipe object. `recipeApplications` is the number of times to apply that recipe.

### `CraftPlanOptions`

```ts
interface CraftPlanOptions {
  strict?: boolean
}
```

| Option | Default | Description |
| --- | --- | --- |
| `strict` | `false` | When `true`, execution splits each plan step into multiple `bot.craft` calls by the result item stack size. This is useful as a workaround for Mineflayer craft-count issues with non-stackable outputs. |

### `CraftingFunc`

```ts
type CraftingFunc = (item: Item, options?: CraftOptions) => CraftingPlan
```

Returned by `buildStatic` and used internally for `bot.planCraft`.

## Working With Plans

To print recipe steps, prefer `recipe.delta` because some Minecraft versions expose empty `recipe.ingredients` arrays for shaped recipes:

```js
function recipeInputs (recipe) {
  return recipe.ingredients && recipe.ingredients.length > 0
    ? recipe.ingredients
    : recipe.delta.filter(item => item.count < 0)
}

for (const step of plan.recipesToDo) {
  const inputs = recipeInputs(step.recipe)
  console.log(inputs, '=>', step.recipe.result, 'x', step.recipeApplications)
}
```

## Test And Smoke Commands

```sh
npm run build
npm test
npm run smoke:matrix
```

Manual static smoke example:

```sh
node scripts/staticPlanSmoke.js --version 1.21.4 --wanted-item stone_pickaxe --available cobblestone:3,oak_log:1
```
