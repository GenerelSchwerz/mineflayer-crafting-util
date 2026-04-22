const { expect } = require('chai')

function stringifyItem (registry, item) {
  const mdItem = registry.items[item.id]

  if (mdItem == null) {
    throw new Error(`Unknown item id: ${item.id}`)
  }

  return { name: mdItem.name, count: item.count }
}

function extractPlanDetails (registry, plan) {
  return {
    itemsRequired: plan.itemsRequired
      .filter((item) => item.count > 0)
      .map((item) => stringifyItem(registry, item)),
    plans: plan.recipesToDo.map(({ recipeApplications, recipe }) => {
      const result = stringifyItem(registry, recipe.result)
      const ingredients =
        recipe.ingredients != null
          ? recipe.ingredients.map((item) => stringifyItem(registry, item))
          : recipe.delta.filter((item) => item.count < 0).map((item) => stringifyItem(registry, item))

      return { ingredients, result, applications: recipeApplications }
    })
  }
}

function findItemByNamePattern (mcDataInstance, patterns) {
  const name = Object.keys(mcDataInstance.itemsByName).find((itemName) =>
    patterns.some((pattern) => pattern.test(itemName))
  )

  expect(name, `Could not find an item matching: ${patterns.map((pattern) => pattern.toString()).join(', ')}`).to.be
    .a('string')

  return mcDataInstance.itemsByName[name]
}

function getItemByPreferredNames (mcDataInstance, candidates, label) {
  const name = candidates.find((candidate) => mcDataInstance.itemsByName[candidate] != null)

  expect(
    name,
    `Could not find a ${label} item. Tried: ${candidates.join(', ')}`
  ).to.be.a('string')

  return mcDataInstance.itemsByName[name]
}

module.exports = {
  getItemByPreferredNames,
  extractPlanDetails,
  findItemByNamePattern,
  stringifyItem
}
