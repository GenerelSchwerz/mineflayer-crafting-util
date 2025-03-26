const mcVersion = "1.8.9"

function stringifyItem(registry, item) {
  const mdItem = registry.items[item.id]
  return `${mdItem.name} x ${item.count}`
}

function beautifyPlan(registry, plan) {
  const itemsRequired = plan.itemsRequired.filter(i=>i.count>0).map(stringifyItem.bind(null,registry)).join(", ")
  const plans = plan.recipesToDo.map(recipeAndAmt => {
    const {recipeApplications, recipe} = recipeAndAmt
    
    if (recipe.ingredients != null) {
      const items = recipe.ingredients.map(stringifyItem.bind(null,registry)).join(", ")
      return `${items} => ${stringifyItem(registry,recipe.result)}  (x${recipeApplications})`
    } else {
      const items = recipe.delta.filter(i=>i.count<0).map(stringifyItem.bind(null,registry)).join(", ")
      return `${items} => ${stringifyItem(registry,recipe.result)}  (x${recipeApplications})`
    }
    
  }).join("\n\t")
  return `Items required:\n\t${itemsRequired}\nPlans:\n\t${plans}`
  // return itemsRequired
}

async function main(mcVersion) {

  const mcData = require("minecraft-data")(mcVersion)
  const crafter = await require("../lib").buildStatic(mcData) // buildStatic is async

  const wantedItemName = process.argv[2] || "wooden_pickaxe"
  const wantedAmount = parseInt(process.argv[3]) || 1

  const sticks = {id: mcData.itemsByName[wantedItemName].id, count: wantedAmount}
  const plan = crafter(sticks, {availableItems: [{id: mcData.itemsByName.log.id, count: 2}],multipleRecipes: true})
  // const plan = crafter(sticks)

  console.log(beautifyPlan(mcData, plan))
}

(async () => main(mcVersion))()