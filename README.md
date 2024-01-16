# mineflayer-crafting-util
Simplify crafting, forever.


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


### Installation
`npm i mineflayer-crafting-util`