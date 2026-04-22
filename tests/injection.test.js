const { expect } = require('chai')
const mcData = require('minecraft-data')
const craftingUtil = require('mineflayer-crafting-util')

const { extractPlanDetails, findItemByNamePattern } = require('./helpers')

const injectBot = craftingUtil.plugin || craftingUtil.default
const mcVersion = process.env.MC_VERSION || '1.21.4'

describe(`Bot injection for Minecraft ${mcVersion}`, function () {
  this.timeout(5000)

  let mcDataInstance
  let staticCrafter
  let planksItem
  let stickItem
  let woodenPickaxeItem

  before(async function () {
    mcDataInstance = mcData(mcVersion)
    staticCrafter = await craftingUtil.buildStatic(mcDataInstance)
    planksItem = findItemByNamePattern(mcDataInstance, [/plank/i])
    stickItem = mcDataInstance.itemsByName.stick
    woodenPickaxeItem = mcDataInstance.itemsByName.wooden_pickaxe
  })

  it('adds planning and crafting helpers to a bot', async function () {
    const bot = {
      registry: mcDataInstance,
      inventory: { slots: [] },
      craft: async () => {}
    }

    await injectBot(bot, {})

    expect(bot.planCraft).to.be.a('function')
    expect(bot.planCraftInventory).to.be.a('function')
    expect(bot.craftPlan).to.be.a('function')
    expect(bot.craftItem).to.be.a('function')
  })

  it('uses the bot inventory when planning a craft', async function () {
    const bot = {
      registry: mcDataInstance,
      inventory: {
        slots: [
          null,
          { type: planksItem.id, count: 2 },
          null
        ]
      }
    }

    await injectBot(bot, {})

    const plan = bot.planCraftInventory({ id: stickItem.id, count: 1 })
    const extracted = extractPlanDetails(mcDataInstance, plan)
    const staticPlan = staticCrafter({ id: stickItem.id, count: 1 }, { availableItems: [{ id: planksItem.id, count: 2 }] })

    expect(plan.success).to.equal(true)
    expect(plan.itemsRequired).to.deep.equal([])
    expect(plan.requiresCraftingTable).to.equal(false)
    expect(extracted.plans).to.have.lengthOf(1)
    expect(extracted.plans[0].result.name).to.include('stick')
    expect(extracted.plans[0].result.count).to.equal(4)
    expect(staticPlan).to.deep.equal(plan)
  })

  it('keeps bot.planCraft aligned with the static planner', async function () {
    const bot = {
      registry: mcDataInstance,
      inventory: { slots: [] }
    }

    await injectBot(bot, {})

    const injectedPlan = bot.planCraft({ id: woodenPickaxeItem.id, count: 1 })
    const staticPlan = staticCrafter({ id: woodenPickaxeItem.id, count: 1 })

    expect(extractPlanDetails(mcDataInstance, injectedPlan)).to.deep.equal(
      extractPlanDetails(mcDataInstance, staticPlan)
    )
  })

  it('crafts a plan with an explicit crafting table', async function () {
    const table = { name: 'crafting_table' }
    const calls = []
    const bot = {
      registry: mcDataInstance,
      inventory: {
        slots: [
          null,
          { type: planksItem.id, count: 2 },
          null
        ]
      },
      craft: async (recipe, count, craftingTable) => {
        calls.push({ recipe, count, craftingTable })
      }
    }

    await injectBot(bot, {})

    const plan = bot.planCraftInventory({ id: stickItem.id, count: 1 })
    await bot.craftPlan(plan, table)

    expect(calls).to.have.lengthOf(1)
    expect(calls[0].recipe).to.equal(plan.recipesToDo[0].recipe)
    expect(calls[0].count).to.equal(plan.recipesToDo[0].recipeApplications)
    expect(calls[0].craftingTable).to.equal(table)
  })

  it('crafts an item by id and count with an explicit crafting table', async function () {
    const table = { name: 'crafting_table' }
    const calls = []
    const bot = {
      registry: mcDataInstance,
      inventory: {
        slots: [
          null,
          { type: planksItem.id, count: 2 },
          null
        ]
      },
      craft: async (recipe, count, craftingTable) => {
        calls.push({ recipe, count, craftingTable })
      }
    }

    await injectBot(bot, {})

    const plan = await bot.craftItem(stickItem.id, 1, table)

    expect(plan.success).to.equal(true)
    expect(calls).to.have.lengthOf(1)
    expect(calls[0].recipe).to.equal(plan.recipesToDo[0].recipe)
    expect(calls[0].count).to.equal(plan.recipesToDo[0].recipeApplications)
    expect(calls[0].craftingTable).to.equal(table)
  })

  it('requires a crafting table when crafting a plan', async function () {
    const bot = {
      registry: mcDataInstance,
      inventory: {
        slots: [
          null,
          { type: planksItem.id, count: 2 },
          null
        ]
      },
      craft: async () => {}
    }

    await injectBot(bot, {})

    const plan = bot.planCraftInventory({ id: stickItem.id, count: 1 })
    let error
    try {
      await bot.craftPlan(plan)
    } catch (err) {
      error = err
    }

    expect(error).to.be.an('error')
    expect(error.message).to.include('craftingTable is required')
  })
})
