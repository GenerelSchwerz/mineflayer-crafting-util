const mcVersion = "1.21.4";

function stringifyItem(registry, item) {
  const mdItem = registry.items[item.id];
  return `${mdItem.name} x ${item.count}`;
}

function beautifyPlan(registry, plan) {
  const itemsRequiredBase = plan.itemsRequiredBase
    .filter((i) => i.count > 0)
    .map(stringifyItem.bind(null, registry))
    .join(", ");
  const itemsRequiredImmediate = plan.itemsRequiredImmediate
    .filter((i) => i.count > 0)
    .map(stringifyItem.bind(null, registry))
    .join(", ");
  const itemsRemaining = plan.itemsRemaining
    .filter((i) => i.count > 0)
    .map(stringifyItem.bind(null, registry))
    .join(", ");
  const itemsCreated = plan.itemsCreated
    .filter((i) => i.count > 0)
    .map(stringifyItem.bind(null, registry))
    .join(", ");
  const plans = plan.recipesToDo
    .map((recipeAndAmt) => {
      const { recipeApplications, recipe } = recipeAndAmt;

      if (recipe.ingredients != null) {
        const items = recipe.ingredients.map(stringifyItem.bind(null, registry)).join(", ");
        return `${items} => ${stringifyItem(registry, recipe.result)}  (x${recipeApplications})`;
      } else {
        const items = recipe.delta
          .filter((i) => i.count < 0)
          .map(stringifyItem.bind(null, registry))
          .join(", ");
        return `${items} => ${stringifyItem(registry, recipe.result)}  (x${recipeApplications})`;
      }
    })
    .join("\n\t");
  return `Items required base:\n\t${itemsRequiredBase}\nItems required immediate:\n\t${itemsRequiredImmediate}\nItems remaining:\n\t${itemsRemaining}\nItems created:\n\t${itemsCreated}\nSuccess: ${plan.success}\nPlans:\n\t${plans}`;
  // return itemsRequiredBase
}

async function main(mcVersion) {
  const mcData = require("minecraft-data")(mcVersion);
  const crafter = await require("../lib").buildStatic(mcData); // buildStatic is async

  const wantedItemName = process.argv[2] || "wooden_sword";
  const wantedAmount = parseInt(process.argv[3]) || 3;
  const woodName = mcData.itemsByName.oak_log != null ? "oak_log" : "log";

  const wantedItem = { id: mcData.itemsByName[wantedItemName].id, count: wantedAmount };

  const setup = {
    multipleRecipes: true,
  };

  if (process.argv[2] == null) {
    setup.availableItems = [
      { id: mcData.itemsByName["pale_oak_planks"].id, count: 2},
      { id: mcData.itemsByName["stick"].id, count: 2},
      { id: mcData.itemsByName["oak_log"].id, count: 2},
    ];
  } else {
    // setup.availableItems = [
    //   { id: mcData.itemsByName.cobblestone.id, count: 3 },
    //   { id: mcData.itemsByName[woodName].id, count: 2 },
    //   // { id: mcData.itemsByName["stick"].id, count: 2 },
    // ];
  }

  console.log(setup)
  const plan = crafter(wantedItem, setup);
  // const plan = crafter(sticks)

  console.log(beautifyPlan(mcData, plan));
}

(async () => main(mcVersion))();
