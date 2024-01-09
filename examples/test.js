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

    function findCraftingTable() {
        const craftingTable = bot.findBlock({
            matching: bot.registry.blocksByName.crafting_table.id,
            maxDistance: 3
        })

        if (!craftingTable) {
            bot.chat("No crafting table found")
            return;
        }
        return craftingTable;
    }

    function clearInventory() {
        const inventory = bot.inventory.items()
        for (const item of inventory) {
            if (item.name === "air") continue;
            const mdItem = bot.registry.items[item.type]
            if (!mdItem) continue;
            if (mdItem.stackSize === 1) {
                bot.tossStack(item)
            }
        }
    }

    function normalizeInventoryToItems() {
        return bot.inventory.items().map(item => {return {id: item.type, count: item.count}})
    }

      



    bot.on('chat', async (username, message) => { 
        const [cmd, ...args] = message.split(" ")
    
    
        switch (cmd) {
            case "log":
                logInventory()
                break;
            case "clear":
                clearInventory()
                break;             
            case "plan":
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
            case "craft":
                const name2 = args[0];
                const amt2 = parseInt(args[1] ?? "1");
    
                const mdItem2 = bot.registry.itemsByName[name2];
                if (!mdItem2) {
                    await bot.chat("Item not found")
                    return;
                }

                const items = normalizeInventoryToItems()
                console.log(items.map(stringifyItem).join(", "))

                const item2 = {id: mdItem2.id, count: amt2}
                const plan2 = bot.planCraft(item2, {availableItems: items})  
                
                if (plan2.success === false) {
                    await bot.chat("Can't craft that")
                    return;
                }

                let craftingTable = false;
                if (plan2.requiresCraftingTable) {
                    craftingTable = findCraftingTable()
                    if (!craftingTable) {
                        bot.chat("No crafting table found")
                        return;
                    }

                }
                console.log(plan2.itemsRequired.map(stringifyItem).join(", "))
                for (const info of plan2.recipesToDo) {
                    console.log(info.recipe.delta.map(stringifyItem).join(", "))
                    await bot.chat(`Crafting ${bot.registry.items[info.recipe.result.id].name} x ${info.recipe.result.count}`)
                    await bot.craft(info.recipe, info.recipeApplications, craftingTable)
                    await bot.waitForTicks(10)
                }

                const mdItem3 = bot.registry.items[item2.id];
                await bot.chat(`Crafted ${mdItem3.name} ${item2.count}`)
                const equipItem = bot.inventory.items().find(i=>i.type === item2.id)
                await bot.equip(equipItem, "hand")
                break;
        }
    })
    

})


