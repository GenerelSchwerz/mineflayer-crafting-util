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


const sticks = {id: bot.registry.itemsByName.stick.id, count: 1}
const plan = bot.planCraft(sticks)    
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