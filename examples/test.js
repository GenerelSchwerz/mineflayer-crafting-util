const mineflayer = require("mineflayer")

const crafter = require("mineflayer-crafting-util").plugin

const bot = mineflayer.createBot({
    host: "localhost", // optional
    port: 25565,       // optional
    username: "bot"
})


bot.loadPlugin(crafter)

bot.once("spawn", () => {
    
    function logInventory() {
        const inventory = bot.inventory.items()
        console.log("Inventory:")
        for (const item of inventory) {
            console.log(item.name, "x", item.count)
        }
    }

    // thanks GPT, this is not a thing.
    function logCraftingTable() {
        const inventory = bot.craftingTable.items()
        console.log("Crafting Table:")
        for (const item of inventory) {
            console.log(item.name, "x", item.count)
        }
    }

    function stringifyItem(item) {
        const mdItem = bot.registry.items[item.id]
        return `${mdItem.name} x ${item.count}`
    }

    function beautifyPlan(plan) {
        const items = plan.itemsRequired.filter(i=>i.count>0).map(stringifyItem).join(", ")
        return items
    }


    bot.on('chat', async (username, message) => { 
        const [cmd, ...args] = message.split(" ")
    
    
        switch (cmd) {
            case "craft":
                const name = args[0];
                const amt = parseInt(args[1] ?? "1");
    
                const mdItem = bot.registry.itemsByName[name];
                if (!mdItem) {
                    await bot.chat("Item not found")
                    return;
                }
                const item = {id: mdItem.id, count: amt}
    
                const plan = bot.planCraft(item)
                console.log(plan)

                await bot.chat(beautifyPlan(plan))
                break;
        }
    })
    

})


