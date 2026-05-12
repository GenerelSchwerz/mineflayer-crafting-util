const { expect } = require('chai')
const mcData = require('minecraft-data')
const craftingUtil = require('mineflayer-crafting-util')

const { buildAvailableItems, expectPlanStep, extractPlanDetails, getItemByPreferredNames } = require('./helpers')

const mcVersion = process.env.MC_VERSION || '1.21.4'

describe(`Crafting Tests for Minecraft ${mcVersion}`, function () {
  this.timeout(5000)

  let crafter
  let mcDataInstance

  before(async function () {
    mcDataInstance = mcData(mcVersion)
    const { Recipe } = require('prismarine-recipe')(mcDataInstance)
    crafter = await craftingUtil.buildStatic(Recipe)
  })

  it('replicates the staticTest example for the current version', function () {
    const wantedItem = mcDataInstance.itemsByName.wooden_pickaxe
    const woodItem = getItemByPreferredNames(
      mcDataInstance,
      ['oak_log', 'log'],
      'log'
    )

    const plan = crafter(
      { id: wantedItem.id, count: 1 },
      {
        availableItems: [{ id: woodItem.id, count: 2 }],
        multipleRecipes: true
      }
    )

    const extracted = extractPlanDetails(mcDataInstance, plan)
    const usesModernWoodNames = mcDataInstance.isNewerOrEqualTo('1.21.4')

    expect(plan.success).to.equal(true)
    expect(plan.itemsRequiredBase).to.deep.equal([])
    expect(plan.itemsRequiredImmediate).to.deep.equal([])
    expect(plan.itemsRemaining).to.deep.equal([])
    expect(plan.requiresCraftingTable).to.equal(true)

    const expectedSteps = usesModernWoodNames
      ? [
          {
            ingredients: [{ count: -1, nameIncludes: 'log' }],
            result: { count: 4, nameIncludes: 'plank' },
            applications: 1
          },
          {
            ingredients: [{ count: -2, nameIncludes: 'plank' }],
            result: { count: 4, nameIncludes: 'stick' },
            applications: 1
          },
          {
            ingredients: [{ count: -1, nameIncludes: 'log' }],
            result: { count: 4, nameIncludes: 'plank' },
            applications: 1
          },
          {
            ingredients: [
              { count: -3, nameIncludes: 'plank' },
              { count: -2, nameIncludes: 'stick' }
            ],
            result: { count: 1, nameIncludes: 'wooden_pickaxe' },
            applications: 1
          }
        ]
      : [
          {
            ingredients: [{ count: -1, nameIncludes: 'log' }],
            result: { count: 4, nameIncludes: 'plank' },
            applications: 1
          },
          {
            ingredients: [{ count: -2, nameIncludes: 'plank' }],
            result: { count: 4, nameIncludes: 'stick' },
            applications: 1
          },
          {
            ingredients: [{ count: -1, nameIncludes: 'log' }],
            result: { count: 4, nameIncludes: 'plank' },
            applications: 1
          },
          {
            ingredients: [
              { count: -3, nameIncludes: 'plank' },
              { count: -2, nameIncludes: 'stick' }
            ],
            result: { count: 1, nameIncludes: 'wooden_pickaxe' },
            applications: 1
          }
        ]

    expect(extracted.plans).to.have.lengthOf(expectedSteps.length)

    expectedSteps.forEach((expected) => {
      expectPlanStep(extracted.plans, expected)
    })
  })

  it('crafts a stone pickaxe from cobblestone and one oak log', function () {
    const wantedItem = mcDataInstance.itemsByName.stone_pickaxe
    const woodItem = getItemByPreferredNames(
      mcDataInstance,
      ['oak_log', 'log'],
      'oak log'
    )

    expect(wantedItem, 'Could not find stone_pickaxe').to.exist

    const unconstrainedPlan = crafter({ id: wantedItem.id, count: 1 })
    const unconstrained = extractPlanDetails(mcDataInstance, unconstrainedPlan)

    expect(unconstrainedPlan.success).to.equal(true)
    expectPlanStep(unconstrained.plans, {
      ingredients: [
        { count: -3, nameIncludes: 'cobbl' },
        { count: -2, nameIncludes: 'stick' }
      ],
      result: { count: 1, nameIncludes: 'stone_pickaxe' },
      applications: 1
    })

    const availableItems = buildAvailableItems(mcDataInstance, [
      ['cobblestone', 3],
      [woodItem.name, 1]
    ])
    const plan = crafter(
      { id: wantedItem.id, count: 1 },
      {
        availableItems,
        multipleRecipes: true
      }
    )
    const extracted = extractPlanDetails(mcDataInstance, plan)

    expect(plan.success).to.equal(true)
    expect(plan.itemsRequiredBase.filter((item) => item.count > 0)).to.deep.equal([])
    expect(plan.itemsRequiredImmediate.filter((item) => item.count > 0)).to.deep.equal([])
    expect(plan.itemsRemaining.filter((item) => item.count > 0)).to.deep.equal([])
    expect(plan.requiresCraftingTable).to.equal(true)

    expectPlanStep(extracted.plans, {
      ingredients: [{ count: -1, nameIncludes: 'log' }],
      result: { count: 4, nameIncludes: 'plank' },
      applications: 1
    })
    expectPlanStep(extracted.plans, {
      ingredients: [{ count: -2, nameIncludes: 'plank' }],
      result: { count: 4, nameIncludes: 'stick' },
      applications: 1
    })
    expectPlanStep(extracted.plans, {
      ingredients: [
        { count: -3, nameIncludes: 'cobblestone' },
        { count: -2, nameIncludes: 'stick' }
      ],
      result: { count: 1, nameIncludes: 'stone_pickaxe' },
      applications: 1
    })
  })

  it('crafts multiple wooden swords when stick crafting creates a second plank deficit', function () {
    const wantedItem = mcDataInstance.itemsByName.wooden_sword
    const woodItem = getItemByPreferredNames(
      mcDataInstance,
      ['pale_oak_log', 'oak_log', 'log'],
      'log'
    )

    expect(wantedItem, 'Could not find wooden_sword').to.exist

    const plan = crafter(
      { id: wantedItem.id, count: 5 },
      {
        availableItems: [{ id: woodItem.id, count: 10 }],
        multipleRecipes: true
      }
    )
    const extracted = extractPlanDetails(mcDataInstance, plan)

    expect(plan.success).to.equal(true)
    expect(plan.itemsRequiredBase.filter((item) => item.count > 0)).to.deep.equal([])
    expect(plan.itemsRequiredImmediate.filter((item) => item.count > 0)).to.deep.equal([])
    expect(plan.itemsRemaining.filter((item) => item.count > 0)).to.deep.equal([])
    expect(plan.requiresCraftingTable).to.equal(true)

    const plankApplications = extracted.plans
      .filter((step) => step.result.name.includes('plank'))
      .reduce((total, step) => total + step.applications, 0)
    const stickApplications = extracted.plans
      .filter((step) => step.result.name.includes('stick'))
      .reduce((total, step) => total + step.applications, 0)

    expect(plankApplications).to.equal(4)
    expect(stickApplications).to.equal(2)
    expectPlanStep(extracted.plans, {
      ingredients: [
        { count: -2, nameIncludes: 'plank' },
        { count: -1, nameIncludes: 'stick' }
      ],
      result: { count: 1, nameIncludes: 'wooden_sword' },
      applications: 5
    })
  })

  it('crafts repeated wooden swords across different wood recipes', function () {
    const wantedItem = mcDataInstance.itemsByName.wooden_sword

    expect(wantedItem, 'Could not find wooden_sword').to.exist
    expect(mcDataInstance.itemsByName.pale_oak_planks, 'Could not find pale_oak_planks').to.exist
    expect(mcDataInstance.itemsByName.oak_log, 'Could not find oak_log').to.exist

    const plan = crafter(
      { id: wantedItem.id, count: 2 },
      {
        availableItems: buildAvailableItems(mcDataInstance, [
          ['pale_oak_planks', 2],
          ['stick', 2],
          ['oak_log', 2]
        ]),
        multipleRecipes: true
      }
    )
    const extracted = extractPlanDetails(mcDataInstance, plan)

    expect(plan.success).to.equal(true)
    expect(plan.itemsRequiredBase.filter((item) => item.count > 0)).to.deep.equal([])
    expect(plan.itemsRequiredImmediate.filter((item) => item.count > 0)).to.deep.equal([])
    expect(plan.itemsRemaining.filter((item) => item.count > 0)).to.deep.equal([])
    expect(plan.requiresCraftingTable).to.equal(true)

    expectPlanStep(extracted.plans, {
      ingredients: [
        { count: -2, nameIncludes: 'pale_oak_planks' },
        { count: -1, nameIncludes: 'stick' }
      ],
      result: { count: 1, nameIncludes: 'wooden_sword' },
      applications: 1
    })
    expectPlanStep(extracted.plans, {
      ingredients: [{ count: -1, nameIncludes: 'oak_log' }],
      result: { count: 4, nameIncludes: 'oak_planks' },
      applications: 1
    })
    expectPlanStep(extracted.plans, {
      ingredients: [
        { count: -2, nameIncludes: 'oak_planks' },
        { count: -1, nameIncludes: 'stick' }
      ],
      result: { count: 1, nameIncludes: 'wooden_sword' },
      applications: 1
    })
  })

  it('fails when available items cannot produce enough repeated intermediates', function () {
    const wantedItem = mcDataInstance.itemsByName.iron_pickaxe

    expect(wantedItem, 'Could not find iron_pickaxe').to.exist

    const plan = crafter(
      { id: wantedItem.id, count: 9 },
      {
        availableItems: buildAvailableItems(mcDataInstance, [
          ['iron_block', 3],
          ['oak_log', 2]
        ]),
        multipleRecipes: true
      }
    )
    const extracted = extractPlanDetails(mcDataInstance, plan)

    expect(plan.success).to.equal(false)
    expect(plan.recipesToDo).not.to.deep.equal([])
    expect(extracted.itemsRequiredBase).to.deep.equal([{ name: 'oak_log', count: 1 }])
    expect(extracted.itemsRequiredImmediate).to.deep.equal([{ name: 'stick', count: 2 }])
    expect(extracted.itemsRemaining).to.deep.equal([{ name: 'iron_pickaxe', count: 1 }])
    expect(extracted.itemsCreated).to.deep.include({ name: 'iron_pickaxe', count: 8 })
  })

  it('keeps base requirements in the alternate recipe family used by the partial plan', function () {
    const wantedItem = mcDataInstance.itemsByName.iron_pickaxe
    const woodItem = getItemByPreferredNames(
      mcDataInstance,
      ['pale_oak_log', 'spruce_log', 'log'],
      'alternate log'
    )

    expect(wantedItem, 'Could not find iron_pickaxe').to.exist

    const plan = crafter(
      { id: wantedItem.id, count: 9 },
      {
        availableItems: buildAvailableItems(mcDataInstance, [
          ['iron_block', 3],
          [woodItem.name, 2]
        ]),
        multipleRecipes: true
      }
    )
    const extracted = extractPlanDetails(mcDataInstance, plan)

    expect(plan.success).to.equal(false)
    expect(extracted.itemsRequiredBase).to.deep.equal([{ name: woodItem.name, count: 1 }])
    expect(extracted.itemsRequiredImmediate).to.deep.equal([{ name: 'stick', count: 2 }])
    expect(extracted.itemsRemaining).to.deep.equal([{ name: 'iron_pickaxe', count: 1 }])
    expect(extracted.itemsCreated).to.deep.include({ name: 'iron_pickaxe', count: 8 })
  })

  it('uses alternate plank recipes when enough items are available in one family', function () {
    const wantedItem = mcDataInstance.itemsByName.wooden_sword
    const plankItem = getItemByPreferredNames(
      mcDataInstance,
      ['spruce_planks', 'birch_planks', 'planks'],
      'alternate planks'
    )

    expect(wantedItem, 'Could not find wooden_sword').to.exist

    const plan = crafter(
      { id: wantedItem.id, count: 1 },
      {
        availableItems: buildAvailableItems(mcDataInstance, [
          [plankItem.name, 2],
          ['stick', 1]
        ]),
        multipleRecipes: true
      }
    )
    const extracted = extractPlanDetails(mcDataInstance, plan)

    expect(plan.success).to.equal(true)
    expect(extracted.itemsRequiredBase).to.deep.equal([])
    expect(extracted.itemsRequiredImmediate).to.deep.equal([])
    expect(extracted.itemsRemaining).to.deep.equal([])
    expectPlanStep(extracted.plans, {
      ingredients: [
        { count: -2, nameIncludes: plankItem.name },
        { count: -1, nameIncludes: 'stick' }
      ],
      result: { count: 1, nameIncludes: 'wooden_sword' },
      applications: 1
    })
  })

  it.skip('crafts a wooden sword from mixed plank variants accepted by Minecraft tag recipes', function () {
    const wantedItem = mcDataInstance.itemsByName.wooden_sword

    expect(wantedItem, 'Could not find wooden_sword').to.exist
    expect(mcDataInstance.itemsByName.spruce_planks, 'Could not find spruce_planks').to.exist
    expect(mcDataInstance.itemsByName.birch_planks, 'Could not find birch_planks').to.exist

    const plan = crafter(
      { id: wantedItem.id, count: 1 },
      {
        availableItems: buildAvailableItems(mcDataInstance, [
          ['spruce_planks', 1],
          ['birch_planks', 1],
          ['stick', 1]
        ]),
        multipleRecipes: true
      }
    )

    expect(plan.success).to.equal(true)
  })

  it('splits partial available-item plans into base, immediate, remaining, and created items', function () {
    const wantedItem = mcDataInstance.itemsByName.stick
    const woodItem = getItemByPreferredNames(
      mcDataInstance,
      ['oak_log', 'log'],
      'log'
    )

    expect(wantedItem, 'Could not find stick').to.exist

    const plan = crafter(
      { id: wantedItem.id, count: 14 },
      {
        availableItems: [{ id: woodItem.id, count: 1 }],
        multipleRecipes: true
      }
    )
    const extracted = extractPlanDetails(mcDataInstance, plan)

    expect(plan.success).to.equal(false)
    expect(extracted.itemsRequiredBase).to.deep.equal([{ name: 'oak_log', count: 1 }])
    expect(extracted.itemsRequiredImmediate).to.deep.equal([{ name: 'oak_planks', count: 4 }])
    expect(extracted.itemsRemaining).to.deep.equal([{ name: 'stick', count: 6 }])
    expect(extracted.itemsCreated).to.deep.equal([{ name: 'stick', count: 8 }])
    expectPlanStep(extracted.plans, {
      ingredients: [{ count: -1, nameIncludes: 'log' }],
      result: { count: 4, nameIncludes: 'plank' },
      applications: 1
    })
    expectPlanStep(extracted.plans, {
      ingredients: [{ count: -2, nameIncludes: 'plank' }],
      result: { count: 4, nameIncludes: 'stick' },
      applications: 2
    })
  })

  it('crafts repeated sticks when the first application is already available', function () {
    const wantedItem = mcDataInstance.itemsByName.stick

    expect(wantedItem, 'Could not find stick').to.exist

    const plan = crafter(
      { id: wantedItem.id, count: 14 },
      {
        availableItems: buildAvailableItems(mcDataInstance, [
          ['oak_log', 2],
          ['oak_planks', 2]
        ]),
        multipleRecipes: true
      }
    )
    const extracted = extractPlanDetails(mcDataInstance, plan)

    expect(plan.success).to.equal(true)
    expect(plan.itemsRequiredBase.filter((item) => item.count > 0)).to.deep.equal([])
    expect(plan.itemsRequiredImmediate.filter((item) => item.count > 0)).to.deep.equal([])
    expect(plan.itemsRemaining.filter((item) => item.count > 0)).to.deep.equal([])

    expectPlanStep(extracted.plans, {
      ingredients: [{ count: -1, nameIncludes: 'oak_log' }],
      result: { count: 4, nameIncludes: 'oak_planks' },
      applications: 2
    })
    expectPlanStep(extracted.plans, {
      ingredients: [{ count: -2, nameIncludes: 'oak_planks' }],
      result: { count: 4, nameIncludes: 'stick' },
      applications: 4
    })
  })

  it('crafts repeated iron pickaxes when enough logs are available for sticks', function () {
    const wantedItem = mcDataInstance.itemsByName.iron_pickaxe

    expect(wantedItem, 'Could not find iron_pickaxe').to.exist

    const plan = crafter(
      { id: wantedItem.id, count: 9 },
      {
        availableItems: buildAvailableItems(mcDataInstance, [
          ['iron_block', 3],
          ['oak_log', 3]
        ]),
        multipleRecipes: true
      }
    )
    const extracted = extractPlanDetails(mcDataInstance, plan)

    expect(plan.success).to.equal(true)
    expect(plan.itemsRequiredBase.filter((item) => item.count > 0)).to.deep.equal([])
    expect(plan.itemsRequiredImmediate.filter((item) => item.count > 0)).to.deep.equal([])
    expect(plan.itemsRemaining.filter((item) => item.count > 0)).to.deep.equal([])
    expect(plan.requiresCraftingTable).to.equal(true)

    expectPlanStep(extracted.plans, {
      ingredients: [
        { count: -3, nameIncludes: 'iron_ingot' },
        { count: -2, nameIncludes: 'stick' }
      ],
      result: { count: 1, nameIncludes: 'iron_pickaxe' },
      applications: 9
    })
  })

  it('crafts Bedrock sticks from an oak log through generic plank ingredients', async function () {
    const bedrockData = mcData('bedrock_1.21.130')
    const { Recipe } = require('prismarine-recipe')(bedrockData)
    const bedrockCrafter = await craftingUtil.buildStatic(Recipe)

    const plan = bedrockCrafter(
      { id: bedrockData.itemsByName.stick.id, count: 1 },
      {
        availableItems: [{ id: bedrockData.itemsByName.oak_log.id, count: 1 }],
        careAboutExisting: false,
        includeRecursion: true,
        multipleRecipes: true
      }
    )
    const extracted = extractPlanDetails(bedrockData, plan)

    expect(plan.success).to.equal(true)
    expect(plan.itemsRequiredBase.filter((item) => item.count > 0)).to.deep.equal([])
    expect(plan.itemsRequiredImmediate.filter((item) => item.count > 0)).to.deep.equal([])
    expect(plan.itemsRemaining.filter((item) => item.count > 0)).to.deep.equal([])

    expectPlanStep(extracted.plans, {
      ingredients: [{ count: -1, nameIncludes: 'oak_log' }],
      result: { count: 4, nameIncludes: 'oak_planks' },
      applications: 1
    })
    expectPlanStep(extracted.plans, {
      ingredients: [{ count: -2, nameIncludes: 'planks' }],
      result: { count: 4, nameIncludes: 'stick' },
      applications: 1
    })
  })

  it('crafts a Bedrock wooden pickaxe from oak logs without falling back to crimson recipes', async function () {
    const bedrockData = mcData('bedrock_1.21.130')
    const { Recipe } = require('prismarine-recipe')(bedrockData)
    const bedrockCrafter = await craftingUtil.buildStatic(Recipe)

    const plan = bedrockCrafter(
      { id: bedrockData.itemsByName.wooden_pickaxe.id, count: 1 },
      {
        availableItems: [{ id: bedrockData.itemsByName.oak_log.id, count: 2 }],
        careAboutExisting: false,
        includeRecursion: true,
        multipleRecipes: true
      }
    )
    const extracted = extractPlanDetails(bedrockData, plan)

    expect(plan.success).to.equal(true)
    expect(plan.itemsRequiredBase.filter((item) => item.count > 0)).to.deep.equal([])
    expect(plan.itemsRequiredImmediate.filter((item) => item.count > 0)).to.deep.equal([])
    expect(plan.itemsRemaining.filter((item) => item.count > 0)).to.deep.equal([])
    expect(extracted.plans).to.have.lengthOf(4)
    expect(extracted.plans.some((step) =>
      step.ingredients.some((item) => item.name.includes('crimson')) ||
      step.result.name.includes('crimson')
    )).to.equal(false)

    expectPlanStep(extracted.plans, {
      ingredients: [{ count: -1, nameIncludes: 'oak_log' }],
      result: { count: 4, nameIncludes: 'oak_planks' },
      applications: 1
    })
    expectPlanStep(extracted.plans, {
      ingredients: [{ count: -2, nameIncludes: 'planks' }],
      result: { count: 4, nameIncludes: 'stick' },
      applications: 1
    })
    expectPlanStep(extracted.plans, {
      ingredients: [
        { count: -3, nameIncludes: 'planks' },
        { count: -2, nameIncludes: 'stick' }
      ],
      result: { count: 1, nameIncludes: 'wooden_pickaxe' },
      applications: 1
    })
  })
})
