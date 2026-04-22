# mineflayer-crafting-util
Simplify crafting, forever.

### Bot example usage
```ts
const mineflayer = require("mineflayer")

const crafter = require("mineflayer-crafting-util").plugin

const bot = mineflayer.createBot({
    host: "localhost", // optional
    port: 25565,       // optional
    username: "bot"
})


bot.loadPlugin(crafter)

// what we want to craft
const sticks = {id: bot.registry.itemsByName.stick.id, count: 1}

// the plan created to craft said item
const plan = bot.planCraft(sticks)    

// using the plan to craft the item
for (const info of plan.recipesToDo) {
  await bot.craft(info.recipe, info.recipeApplications, /* crafting table */)
}
```


### Static usage
```ts
const mcVersion = "1.18.2"

async function main(mcVersion: string) {

  const mcData = require("minecraft-data")(mcVersion)
  const crafter = await require("mineflayer-crafting-util").buildStatic(mcVersion) // buildStatic is async

  const sticks = {id: mcData.itemsByName.stick.id, count: 1}
  const plan = crafter(sticks)

}

(async () => main(mcVersion))()
```



## Installation

It must be installed via a node package manager.

node: `npm i mineflayer-crafting-util`

yarn: `yarn add mineflayer-crafting-util`


# API

## Functions

### Bot Functions

#### bot.planCraft
```ts
bot.planCraft(item: Item, opts?: CraftOptions): CraftingPlan
```
| Parameter | Type | Description |
| --- | --- | --- |
| item | <code><a href="#item">Item</a></code> | the type and count of item to craft |
| opts | <code><a href="#craftoptions">CraftOptions</a></code> | The options for crafting |

#### bot.planCraftInventory
```ts
bot.planCraftInventory(wantedItem: Item): CraftingPlan
```
| Parameter | Type | Description |
| --- | --- | --- |
| wantedItem | <code><a href="#item">Item</a></code> | The item to craft |


### Static Functions
<i>The static function provided is the same as <a href="#botplancraft"><code>bot.planCraft</code></i>.


## Types

#### Item
<!-- slanted note -->
| Property | Type | Description |
| --- | --- | --- |
| id | number | The item id |
| count | number | The item count |


#### CraftingPlan
| Property | Type | Description |
| --- | --- | --- |
| success | boolean | Whether the crafting plan was successful |
| itemsRequired | <code><a href="#item">Item</a>[]</code> | The items required to craft the item |
| recipesToDo | <code>Array<{ recipeApplications: number; recipe: <a href="https://github.com/PrismarineJS/prismarine-recipe?tab=readme-ov-file#recipefinditemtype-metadata">Recipe</a> }></code> | The recipes to craft the item |

#### CraftOptions
| Property | Type | Default | Description |
| --- | --- | --- | --- |
| availableItems | <code><a href="#item">Item</a>[]</code> |  | The items available to the bot |
| careAboutExisting | boolean | false | Whether to care about existing items |
| includeRecursion | boolean | false | Whether to include recursion |
| multipleRecipes | boolean | false | Whether to include multiple recipes |

#### CraftingFunc
| Parameter | Type | Description |
| --- | --- | --- |
| item | <code><a href="#item">Item</a></code> | The item to craft |
| opts | <code><a href="#craftoptions">CraftOptions</a></code> | The options for crafting |

| Returns | Type | Description |
| --- | --- | --- |
| CraftingPlan | <code><a href="#craftingplan">CraftingPlan</a></code> | The crafting plan |
