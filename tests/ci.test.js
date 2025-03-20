const { expect } = require("chai");
const mcData = require("minecraft-data");
const craftingUtil = require("mineflayer-crafting-util");

const mcVersion = process.env.MC_VERSION || "1.21.4";

function stringifyItem(registry, item) {
  const mdItem = registry.items[item.id];
  return { name: mdItem.name, count: item.count };
}

function extractPlanDetails(registry, plan) {
  return {
    itemsRequired: plan.itemsRequired
      .filter(i => i.count > 0)
      .map(i => stringifyItem(registry, i)),
    plans: plan.recipesToDo.map(({ recipeApplications, recipe }) => {
      const result = stringifyItem(registry, recipe.result);
      const ingredients =
        recipe.ingredients != null
          ? recipe.ingredients.map(i => stringifyItem(registry, i))
          : recipe.delta.filter(i => i.count < 0).map(i => stringifyItem(registry, i));

      return { ingredients, result, applications: recipeApplications };
    }),
  };
}

describe(`Crafting Tests for Minecraft ${mcVersion}`, function () {
  this.timeout(5000); // Ensure enough time for async operations

  let crafter, mcDataInstance;

  before(async function () {
    mcDataInstance = mcData(mcVersion);
    crafter = await craftingUtil.buildStatic(mcDataInstance);
  });

  it("should generate the correct crafting plan for a wooden pickaxe", function () {
    const wantedItem = mcDataInstance.itemsByName["wooden_pickaxe"];
    const wantedAmount = 1;

    const request = { id: wantedItem.id, count: wantedAmount };
    const plan = crafter(request);
    const extracted = extractPlanDetails(mcDataInstance, plan);

    // Validate that at least one required item contains "log"
    const hasValidLog = extracted.itemsRequired.some(
      item => item.name.includes("log") && item.count === 2
    );
    expect(hasValidLog, "Missing valid log entry").to.be.true;

    // Expected recipe steps with flexible name checking
    const expectedSteps = [
      { ingredients: [{ count: -1, nameIncludes: "log" }], result: { count: 4, nameIncludes: "planks" }, applications: 1 },
      { ingredients: [{ count: -1, nameIncludes: "log" }], result: { count: 4, nameIncludes: "planks" }, applications: 1 },
      { ingredients: [{ count: -2, nameIncludes: "planks" }], result: { count: 4, nameIncludes: "stick" }, applications: 1 },
      { ingredients: [{ count: -3, nameIncludes: "planks" }, { count: -2, nameIncludes: "stick" }], result: { count: 1, nameIncludes: "wooden_pickaxe" }, applications: 1 },
    ];

    // Validate each step in the plan
    expectedSteps.forEach(expected => {
      const matches = extracted.plans.some(planStep => {
        return (
          planStep.applications === expected.applications &&
          planStep.result.count === expected.result.count &&
          planStep.result.name.includes(expected.result.nameIncludes) &&
          expected.ingredients.every(expectedIng =>
            planStep.ingredients.some(
              actualIng => actualIng.count === expectedIng.count && actualIng.name.includes(expectedIng.nameIncludes)
            )
          )
        );
      });

      expect(matches, `Missing expected crafting step: ${JSON.stringify(expected)}`).to.be.true;
    });
  });
});
