const { expect } = require("chai");
const mcData = require("minecraft-data");
const craftingUtil = require("mineflayer-crafting-util");

const { extractPlanDetails, getItemByPreferredNames } = require("./helpers");

const mcVersion = process.env.MC_VERSION || "1.21.4";

function findStepByShape(steps, expected) {
  return steps.some((step) => {
    return (
      step.applications === expected.applications &&
      step.result.count === expected.result.count &&
      step.result.name.includes(expected.result.nameIncludes) &&
      expected.ingredients.every((expectedIng) =>
        step.ingredients.some(
          (actualIng) =>
            actualIng.count === expectedIng.count && actualIng.name.includes(expectedIng.nameIncludes)
        )
      )
    );
  });
}

describe(`Crafting Tests for Minecraft ${mcVersion}`, function () {
  this.timeout(5000);

  let crafter;
  let mcDataInstance;

  before(async function () {
    mcDataInstance = mcData(mcVersion);
    crafter = await craftingUtil.buildStatic(mcDataInstance);
  });

  it("replicates the staticTest example for the current version", function () {
    const wantedItem = mcDataInstance.itemsByName.wooden_pickaxe;
    const woodItem = getItemByPreferredNames(
      mcDataInstance,
      ["oak_log", "log"],
      "log"
    );

    const plan = crafter(
      { id: wantedItem.id, count: 1 },
      {
        availableItems: [{ id: woodItem.id, count: 2 }],
        multipleRecipes: true,
      }
    );

    const extracted = extractPlanDetails(mcDataInstance, plan);
    const usesModernWoodNames = mcDataInstance.isNewerOrEqualTo("1.21.4");

    expect(plan.success).to.equal(true);
    expect(plan.itemsRequired).to.deep.equal([]);
    expect(plan.requiresCraftingTable).to.equal(true);

    const expectedSteps = usesModernWoodNames
      ? [
          {
            ingredients: [{ count: -1, nameIncludes: "log" }],
            result: { count: 4, nameIncludes: "plank" },
            applications: 1,
          },
          {
            ingredients: [{ count: -2, nameIncludes: "plank" }],
            result: { count: 4, nameIncludes: "stick" },
            applications: 1,
          },
          {
            ingredients: [{ count: -1, nameIncludes: "log" }],
            result: { count: 4, nameIncludes: "plank" },
            applications: 1,
          },
          {
            ingredients: [
              { count: -3, nameIncludes: "plank" },
              { count: -2, nameIncludes: "stick" },
            ],
            result: { count: 1, nameIncludes: "wooden_pickaxe" },
            applications: 1,
          },
        ]
      : [
          {
            ingredients: [{ count: -1, nameIncludes: "log" }],
            result: { count: 4, nameIncludes: "plank" },
            applications: 1,
          },
          {
            ingredients: [{ count: -2, nameIncludes: "plank" }],
            result: { count: 4, nameIncludes: "stick" },
            applications: 1,
          },
          {
            ingredients: [{ count: -1, nameIncludes: "log" }],
            result: { count: 4, nameIncludes: "plank" },
            applications: 1,
          },
          {
            ingredients: [
              { count: -3, nameIncludes: "plank" },
              { count: -2, nameIncludes: "stick" },
            ],
            result: { count: 1, nameIncludes: "wooden_pickaxe" },
            applications: 1,
          },
        ];

    expect(extracted.plans).to.have.lengthOf(expectedSteps.length);

    expectedSteps.forEach((expected) => {
      expect(
        findStepByShape(extracted.plans, expected),
        `Missing expected crafting step: ${JSON.stringify(expected)}`
      ).to.equal(true);
    });
  });
});
