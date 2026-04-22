const { expect } = require("chai");
const mcData = require("minecraft-data");
const craftingUtil = require("mineflayer-crafting-util");

const { extractPlanDetails, findItemByNamePattern } = require("./helpers");

const injectBot = craftingUtil.plugin || craftingUtil.default;
const mcVersion = process.env.MC_VERSION || "1.21.4";

describe(`Bot injection for Minecraft ${mcVersion}`, function () {
  this.timeout(5000);

  let mcDataInstance;
  let staticCrafter;
  let planksItem;
  let stickItem;
  let woodenPickaxeItem;

  before(async function () {
    mcDataInstance = mcData(mcVersion);
    staticCrafter = await craftingUtil.buildStatic(mcDataInstance);
    planksItem = findItemByNamePattern(mcDataInstance, [/plank/i]);
    stickItem = mcDataInstance.itemsByName.stick;
    woodenPickaxeItem = mcDataInstance.itemsByName.wooden_pickaxe;
  });

  it("adds planCraft and planCraftInventory to a bot", async function () {
    const bot = {
      registry: mcDataInstance,
      inventory: { slots: [] },
    };

    await injectBot(bot, {});

    expect(bot.planCraft).to.be.a("function");
    expect(bot.planCraftInventory).to.be.a("function");
  });

  it("uses the bot inventory when planning a craft", async function () {
    const bot = {
      registry: mcDataInstance,
      inventory: {
        slots: [
          null,
          { type: planksItem.id, count: 2 },
          null,
        ],
      },
    };

    await injectBot(bot, {});

    const plan = bot.planCraftInventory({ id: stickItem.id, count: 1 });
    const extracted = extractPlanDetails(mcDataInstance, plan);
    const staticPlan = staticCrafter({ id: stickItem.id, count: 1 }, { availableItems: [{ id: planksItem.id, count: 2 }] });

    expect(plan.success).to.equal(true);
    expect(plan.itemsRequired).to.deep.equal([]);
    expect(plan.requiresCraftingTable).to.equal(false);
    expect(extracted.plans).to.have.lengthOf(1);
    expect(extracted.plans[0].result.name).to.include("stick");
    expect(extracted.plans[0].result.count).to.equal(4);
    expect(staticPlan).to.deep.equal(plan);
  });

  it("keeps bot.planCraft aligned with the static planner", async function () {
    const bot = {
      registry: mcDataInstance,
      inventory: { slots: [] },
    };

    await injectBot(bot, {});

    const injectedPlan = bot.planCraft({ id: woodenPickaxeItem.id, count: 1 });
    const staticPlan = staticCrafter({ id: woodenPickaxeItem.id, count: 1 });

    expect(extractPlanDetails(mcDataInstance, injectedPlan)).to.deep.equal(
      extractPlanDetails(mcDataInstance, staticPlan)
    );
  });
});
