const mineflayer = require("mineflayer");

const crafter = require("../lib").plugin;

const bot = mineflayer.createBot({
  host: process.argv[2], // optional
  port: Number.isNaN(Number(process.argv[3])) ? 25565 : Number(process.argv[3]), // optional
  username: "testing1",
  auth: "microsoft",
  version: "1.21.4",
});

bot.loadPlugin(crafter);

async function setup(bot, ...args) {
  const name = args[0];
  const amt = parseInt(args[1] ?? "1");

  const mdItem = bot.registry.itemsByName[name];
  if (!mdItem) {
    await bot.chat("Item not found");
    return;
  }

  const items = normalizeInventoryToItems(bot);

  const item2 = { id: mdItem.id, count: amt };
  const plan = bot.planCraft(item2, { availableItems: items });

  if (plan.success === false) {
    await bot.chat("Can't craft that");
    console.log(plan);
    return;
  }

  let craftingTable = null;
  if (plan.requiresCraftingTable) {
    craftingTable = findCraftingTable(bot);
    if (!craftingTable) {
      bot.chat("No crafting table found");
      return;
    }
  }

  return { plan: plan, item: mdItem, craftingTable };
}

function stringifyItem(item) {
  const mdItem = bot.registry.items[item.id];
  return `${mdItem.name} x ${item.count}`;
}

function beautifyPlan(plan) {
  const items = plan.itemsRequired
    .filter((i) => i.count > 0)
    .map(stringifyItem)
    .join(", ");
  return items;
}

function normalizeInventoryToItems(bot) {
  return bot.inventory.items().map((item) => {
    return { id: item.type, count: item.count };
  });
}

  function findCraftingTable(bot) {
    const craftingTable = bot.findBlock({
      matching: bot.registry.blocksByName.crafting_table.id,
      maxDistance: 3,
    });

    if (!craftingTable) {
      bot.chat("No crafting table found");
      return;
    }
    return craftingTable;
  }

bot.once("spawn", () => {
  function logInventory() {
    const inventory = bot.inventory.items();
    console.log("Inventory:");
    for (const item of inventory) {
      console.log(item.name, "x", item.count);
    }
  }



  async function clearInventory() {
    const inventory = bot.inventory.slots;
    for (const item of inventory) {
      if (!item) continue;
      if (item.name === "air") continue;
      const mdItem = bot.registry.items[item.type];
      if (!mdItem) continue;
      if (mdItem.stackSize === 1) {
        await bot.tossStack(item);
      }
    }
  }

  bot.on("chat", async (username, message) => {
    const [cmd, ...args] = message.split(" ");

    switch (cmd) {
      case "testall":
        try {
          Object.values(bot.registry.itemsByName).forEach((i) => bot.planCraft({ id: i.id, count: 1 }));
          bot.chat("All items succeeded!");
        } catch (e) {
          bot.chat("Had an error. Check console.");
          console.log(e);
        }
        break;
      case "log":
        logInventory();
        break;
      case "drop":
        clearInventory();
        break;
      case "plan": {
        const name = args[0];
        const amt = parseInt(args[1] ?? "1");

        const mdItem = bot.registry.itemsByName[name];
        if (!mdItem) {
          await bot.chat("Item not found");
          return;
        }
        const item = { id: mdItem.id, count: amt };

        const plan = bot.planCraft(item);
        console.log(plan);

        await bot.chat(beautifyPlan(plan));
        break;
      }

      case "fastcraft": {
        const name = args[0];
        const amt = parseInt(args[1] ?? "1");

        const mdItem = bot.registry.itemsByName[name];
        if (!mdItem) return await bot.chat("Item not found");

        const craftingTable = findCraftingTable(bot);
        if (!craftingTable) return bot.chat("No crafting table found");

        const plan = await bot.craftItem(mdItem.id, amt, craftingTable, {}, { strict: true });
        bot.chat(`finished crafting ${name} x ${amt}`);

        console.log(bot.inventory.slots.filter(i=>!!i).map(i=>[i.name, i.count, i.stackSize]))
        const found = bot.inventory.findInventoryItem(mdItem.id);
        if (found == null) return bot.chat("didnt actually craft the item...");

        await bot.equip(found, "hand");
        break;
      }

      case "craft": {
        const res = await setup(bot, ...args);
        const  { plan, item, craftingTable } = res;

        let idx = 0;
        console.log(plan.itemsRequired.map(stringifyItem).join(", "));
        console.log(plan.recipesToDo);
        for (const info of plan.recipesToDo) {
          console.log(idx, info.recipe.delta.map(stringifyItem).join(", "));
          await bot.chat(`Crafting (${info.recipeApplications}x) ${bot.registry.items[info.recipe.result.id].name} x ${info.recipe.result.count}`);
          await bot.craft(info.recipe, info.recipeApplications, craftingTable);
          idx++;
          
          console.log(bot.inventory.items().map(i=>[i.name, i.count]))
          await bot.waitForTicks(10);
        }

        const mdItem3 = bot.registry.items[item.id];
        await bot.chat(`Crafted ${mdItem3.name} ${item.count}`);
        const equipItem = bot.inventory.items().find((i) => i.type === item.id);
        await bot.equip(equipItem, "hand");
        break;
      }
    }
  });
});
