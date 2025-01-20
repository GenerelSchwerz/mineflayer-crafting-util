const mcVersion = "1.18.2"

function stringifyItem(registry, item) {
  const mdItem = registry.items[item.id]
  return `${mdItem.name} x ${item.count}`
}

function beautifyPlan(registry, plan) {
  const items = plan.itemsRequired.filter(i=>i.count>0).map(stringifyItem.bind(null,registry)).join(", ")
  return items
}

async function main(mcVersion) {

  const mcData = require("minecraft-data")(mcVersion)
  const crafter = await require("mineflayer-crafting-util").buildStatic(mcVersion) // buildStatic is async

  const sticks = {id: mcData.itemsByName.stone_sword.id, count: 1}
  const plan = crafter(sticks)

  console.log(beautifyPlan(mcData, plan))
}

(async () => main(mcVersion))()