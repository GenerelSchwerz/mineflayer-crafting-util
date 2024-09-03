const mcVersion = "1.18.2"

async function main(mcVersion) {

  const mcData = require("minecraft-data")(mcVersion)
  const crafter = await require("mineflayer-crafting-util").buildStatic(mcVersion) // buildStatic is async

  const sticks = {id: mcData.itemsByName.stick.id, count: 1}
  const plan = crafter(sticks)
  console.log(plan)

}

(async () => main(mcVersion))()