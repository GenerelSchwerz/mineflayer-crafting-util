import minecraftData from 'minecraft-data';

interface Item {
  id: number;
  count: number;
}

interface Recipe {
  ingredients: Item[] | null;
  delta: Item[];
  result: Item;
}

interface RecipeAndAmt {
  recipe: Recipe;
  recipeApplications: number;
}

interface Plan {
  itemsRequired: Item[];
  recipesToDo: RecipeAndAmt[];
}

interface Registry {
  items: { [key: number]: { name: string } };
  itemsByName: { [key: string]: { id: number } };
}

function stringifyItem(registry: Registry, item: Item): string {
  const mdItem = registry.items[item.id];
  return `${mdItem.name} x ${item.count}`;
}

function beautifyPlan(registry: Registry, plan: Plan): string {
  const itemsRequired = plan.itemsRequired.filter(i => i.count > 0).map(stringifyItem.bind(null, registry)).join(", ");
  const plans = plan.recipesToDo.map(recipeAndAmt => {
    const { recipeApplications, recipe } = recipeAndAmt;
    
    if (recipe.ingredients != null) {
      const items = recipe.ingredients.map(stringifyItem.bind(null, registry)).join(", ");
      return `${items} => ${stringifyItem(registry, recipe.result)}  (x${recipeApplications})`;
    } else {
      const items = recipe.delta.filter(i => i.count < 0).map(stringifyItem.bind(null, registry)).join(", ");
      return `${items} => ${stringifyItem(registry, recipe.result)}  (x${recipeApplications})`;
    }
  }).join("\n\t");

  return `Items required:\n\t${itemsRequired}\nPlans:\n\t${plans}`;
}

async function main(mcVersion: string): Promise<void> {
  const mcData = minecraftData(mcVersion);
  const crafter = await (await import("../src")).buildStatic(mcData); // buildStatic is async

  const wantedItemName = process.argv[2] || "wooden_pickaxe";
  const wantedAmount = parseInt(process.argv[3]) || 1;

  const sticks: Item = { id: mcData.itemsByName[wantedItemName].id, count: wantedAmount };
  const plan = crafter(sticks, {availableItems: [{id: mcData.itemsByName.oak_log.id, count: 2}],multipleRecipes: true})
//   const plan = crafter(sticks);

  console.log(beautifyPlan(mcData, plan));
}

(async () => main("1.21.4"))();
