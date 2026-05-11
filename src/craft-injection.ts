/* eslint-disable no-labels */
import type { Recipe as PRecipe } from 'prismarine-recipe'
import type { CraftOptions, Item, CraftingPlan } from './types'

type CraftingFunc = (item: Item, opts?: CraftOptions) => CraftingPlan
interface PlanResult {
  success: boolean
  itemsRequiredBase: Item[]
  itemsRequiredImmediate: Item[]
  itemsRemaining: Item[]
  itemsCreated: Item[]
  recipesToDo: Array<{ recipeApplications: number, recipe: PRecipe }>
}

function recipeInputs (recipe: PRecipe): Item[] {
  if (recipe.ingredients != null && recipe.ingredients.length > 0) return recipe.ingredients
  return recipe.delta.filter((item) => item.count < 0)
}

type ItemMatcher = (wantedId: number, availableId: number) => boolean

const strictItemMatcher: ItemMatcher = (wantedId, availableId) => wantedId === availableId

function availableItemCount (
  availableItems: Item[],
  itemId: number,
  itemMatches: ItemMatcher = strictItemMatcher
): number {
  return availableItems
    .filter((item) => itemMatches(itemId, item.id))
    .reduce((total, item) => total + item.count, 0)
}

function canCraftRecipe (
  availableItems: Item[],
  recipe: PRecipe,
  recipeApplications: number,
  itemMatches: ItemMatcher = strictItemMatcher
): boolean {
  return recipeInputs(recipe).every((input) =>
    availableItemCount(availableItems, input.id, itemMatches) >= -input.count * recipeApplications
  )
}

function applyRecipeResults (
  items: Item[],
  recipesToDo: Array<{ recipeApplications: number, recipe: PRecipe }>
): void {
  for (const toDo of recipesToDo) {
    for (const item of toDo.recipe.delta) {
      const index = items.findIndex((e) => e.id === item.id)
      if (index !== -1) {
        items[index].count += item.count * toDo.recipeApplications
      } else {
        items.push({ id: item.id, count: item.count * toDo.recipeApplications })
      }
    }
  }
}

function replaceItems (targetItems: Item[], sourceItems: Item[]): void {
  targetItems.splice(0, targetItems.length, ...sourceItems.map((item) => ({ ...item })))
}

function addItem (items: Item[], item: Item): void {
  const existing = items.find((existingItem) => existingItem.id === item.id)

  if (existing != null) {
    existing.count += item.count
  } else {
    items.push({ ...item })
  }
}

function reserveItem (
  items: Item[],
  itemId: number,
  count: number,
  itemMatches: ItemMatcher = strictItemMatcher
): Item[] {
  const reservedItems = items.map((item) => ({ ...item }))

  for (const item of reservedItems) {
    if (!itemMatches(itemId, item.id)) continue

    const reserved = Math.min(item.count, count)
    item.count -= reserved
    count -= reserved
    if (count <= 0) break
  }

  return reservedItems.filter((item) => item.count > 0)
}

function cloneAvailableItems (items: Item[]): Item[] {
  return items
    .filter((item) => item.count > 0)
    .map((item) => ({ ...item }))
}

function addItems (items: Item[], itemToAdd: Item): void {
  const item = items.find((item) => item.id === itemToAdd.id)

  if (item != null) {
    item.count += itemToAdd.count
  } else {
    items.push({ ...itemToAdd })
  }
}

function mergeItems (items: Item[]): Item[] {
  const merged: Item[] = []

  for (const item of items) {
    if (item.count > 0) addItems(merged, item)
  }

  return merged
}

function summarizeItemsCreated (
  recipesToDo: Array<{ recipeApplications: number, recipe: PRecipe }>
): Item[] {
  const map = new Map<number, number>()

  for (const toDo of recipesToDo) {
    for (const item of toDo.recipe.delta) {
      map.set(item.id, (map.get(item.id) ?? 0) + item.count * toDo.recipeApplications)
    }
  }

  return Array.from(map.entries())
    .filter(([, count]) => count > 0)
    .map(([id, count]) => ({ id, count }))
}

function createPlanResult (
  success: boolean,
  itemsRequiredBase: Item[],
  recipesToDo: Array<{ recipeApplications: number, recipe: PRecipe }>,
  itemsCreated = summarizeItemsCreated(recipesToDo),
  itemsRequiredImmediate = itemsRequiredBase,
  itemsRemaining: Item[] = []
): PlanResult {
  return {
    success,
    itemsRequiredBase,
    itemsRequiredImmediate,
    itemsRemaining,
    itemsCreated,
    recipesToDo
  }
}

function isConcretePlanForAvailableItems (
  plan: PlanResult,
  availableItems: Item[],
  itemMatches: ItemMatcher = strictItemMatcher
): boolean {
  if (!plan.success) return true
  if (!Array.isArray(plan.recipesToDo)) return false

  const currentItems = cloneAvailableItems(availableItems)

  for (const toDo of plan.recipesToDo) {
    if (
      toDo == null ||
      toDo.recipe == null ||
      toDo.recipe.result == null ||
      !Array.isArray(toDo.recipe.delta) ||
      !Number.isFinite(toDo.recipeApplications) ||
      toDo.recipeApplications <= 0
    ) {
      return false
    }

    if (!canCraftRecipe(currentItems, toDo.recipe, toDo.recipeApplications, itemMatches)) return false
    applyRecipeResults(currentItems, [toDo])
  }

  return true
}

export function _build (Recipe: typeof PRecipe): CraftingFunc {
  const acceptedItemIds = new Map<number, Set<number>>()

  function getAcceptedItemIds (itemId: number): Set<number> {
    const cached = acceptedItemIds.get(itemId)
    if (cached != null) return cached

    const ids = new Set<number>([itemId])

    for (const recipe of Recipe.find(itemId, null)) {
      if (recipe.result?.id != null) ids.add(recipe.result.id)
    }

    acceptedItemIds.set(itemId, ids)
    return ids
  }

  function itemMatchesIngredient (ingredientId: number, availableId: number): boolean {
    return getAcceptedItemIds(ingredientId).has(availableId)
  }

  function canProvideIngredientDirectly (
    item: Item,
    availableItems: Item[]
  ): boolean {
    if (availableItemCount(availableItems, item.id, itemMatchesIngredient) >= item.count) return true

    return Recipe.find(item.id, null).some((recipe) => {
      const recipeApplications = Math.ceil(item.count / recipe.result.count)
      return canCraftRecipe(availableItems, recipe, recipeApplications, itemMatchesIngredient)
    })
  }

  function getRecipeDeficits (
    availableItems: Item[],
    recipe: PRecipe,
    recipeApplications: number
  ): Item[] {
    return recipeInputs(recipe)
      .map((input) => {
        const required = -input.count * recipeApplications
        const available = availableItemCount(availableItems, input.id, itemMatchesIngredient)
        return { id: input.id, count: required - available }
      })
      .filter((item) => item.count > 0)
  }

  function findPlannedRecipe (
    itemId: number,
    recipesToDo: Array<{ recipeApplications: number, recipe: PRecipe }>
  ): PRecipe | undefined {
    for (let i = recipesToDo.length - 1; i >= 0; i--) {
      if (recipesToDo[i].recipe.result.id === itemId) return recipesToDo[i].recipe
    }
    return undefined
  }

  function getBaseRequirements (
    items: Item[],
    opts: CraftOptions,
    recipesToDo: Array<{ recipeApplications: number, recipe: PRecipe }> = [],
    seen = new Set<number>()
  ): Item[] {
    const requirements: Item[] = []

    for (const item of items) {
      const recipe = findPlannedRecipe(item.id, recipesToDo)
      if (recipe != null && !seen.has(item.id)) {
        seen.add(item.id)
        const recipeApplications = Math.ceil(item.count / recipe.result.count)
        const inputs = recipeInputs(recipe).map((input) => ({
          id: input.id,
          count: -input.count * recipeApplications
        }))

        for (const required of getBaseRequirements(inputs, opts, recipesToDo, seen)) {
          addItems(requirements, required)
        }

        seen.delete(item.id)
        continue
      }

      const data = _newCraft(
        item,
        {
          ...opts,
          availableItems: undefined
        },
        new Map()
      )

      for (const required of data.itemsRequiredBase) addItems(requirements, required)
    }

    return mergeItems(requirements)
  }

  function getPartialRequirements (
    itemId: number,
    remainingCount: number,
    availableItems: Item[],
    recipesToDo: Array<{ recipeApplications: number, recipe: PRecipe }>,
    opts: CraftOptions
  ): { itemsRequiredBase: Item[], itemsRequiredImmediate: Item[], itemsRemaining: Item[] } {
    const remaining = [{ id: itemId, count: remainingCount }]
    const currentItems = cloneAvailableItems(availableItems)
    applyRecipeResults(currentItems, recipesToDo)

    let completionRecipe: PRecipe | undefined
    for (let i = recipesToDo.length - 1; i >= 0; i--) {
      if (recipesToDo[i].recipe.result.id === itemId) {
        completionRecipe = recipesToDo[i].recipe
        break
      }
    }

    if (completionRecipe == null) {
      return {
        itemsRequiredBase: remaining,
        itemsRequiredImmediate: remaining,
        itemsRemaining: remaining
      }
    }

    const recipeApplications = Math.ceil(remainingCount / completionRecipe.result.count)
    const immediate = mergeItems(getRecipeDeficits(currentItems, completionRecipe, recipeApplications))
    const base = getBaseRequirements(immediate, opts, recipesToDo)

    return {
      itemsRequiredBase: base,
      itemsRequiredImmediate: immediate,
      itemsRemaining: remaining
    }
  }

  function _newCraft (
    item: Item,
    opts: CraftOptions = {},
    seen = new Map(),
    target = item.count
  ): PlanResult {
    const id = item.id
    let recipes = Recipe.find(id, null)

    const availableItems = opts.availableItems
    const includeRecursion = opts.includeRecursion ?? false
    const multipleRecipes = opts.multipleRecipes ?? false

    let matchingItem
    let recipeWanted

    let count = item.count

    const ret0: Item[] = []
    const ret1: Array<{
      recipeApplications: number
      recipe: PRecipe
    }> = []

    // disregard recipes that combine the item itself back together, as that is pointless for our usecase.
    recipes = recipes.filter((r) => r.delta.slice(0, -1).some((e) => e.id !== id))

    if (availableItems !== undefined) {
      matchingItem = availableItems.find((e) => itemMatchesIngredient(id, e.id) && e.count >= target)
      if (matchingItem != null) {
        if (matchingItem.count >= target) {
          return createPlanResult(true, [], []) // already have item, no need to craft it.
        } else {
          count -= matchingItem.count
        }
      }

      if (recipes.length === 0) {
        return createPlanResult(true, [item], [])
      }

      if (seen.has(id)) {
        return createPlanResult(false, [item], [])
      }

      seen.set(id, item)

      recipeWanted = recipes.find((r) => {
        const recipeApplications = Math.ceil(count / r.result.count)
        return canCraftRecipe(availableItems, r, recipeApplications, itemMatchesIngredient)
      })

      if (recipeWanted == null) {
        // since no recipes exist with all items available, search for the recipe with the most amount of items available inline

        const scoredRecipes = recipes
          .map((recipe) => {
            const ingredients = recipeInputs(recipe).map((e) => ({ id: e.id, count: -e.count }))
            const score = ingredients.filter((ingredient) => canProvideIngredientDirectly(ingredient, availableItems)).length

            return { recipe, score }
          })
          .sort((a, b) => b.score - a.score)

        const mostAmt = scoredRecipes[0]?.score ?? 0

        // store current amount of items available to be crafted
        let craftedCount = 0
        let bestPartialCount = 0
        let bestPartialRecipes: Array<{ recipeApplications: number, recipe: PRecipe }> = []

        outer: for (const scoredRecipe of scoredRecipes) {
          if (scoredRecipe.score !== mostAmt) continue

          // Candidate planning mutates inventory counts, so isolate attempts until one fully succeeds.
          const candidateItems = cloneAvailableItems(availableItems)
          const candidateOpts: CraftOptions = {
            ...opts,
            availableItems: candidateItems
          }
          const currentItems = candidateItems
          const candidateSeen = new Map(seen)
          const candidateRecipes: Array<{ recipeApplications: number, recipe: PRecipe }> = []
          const recipe = scoredRecipe.recipe
          const recipeIngredients = recipeInputs(recipe)

          // all items that need to be crafted to craft this recipe
          let ingredients = recipeIngredients.filter((i) => availableItemCount(currentItems, i.id, itemMatchesIngredient) < -i.count)

          // store all results for crafting attempts on all ingredients of current recipe
          const results: Array<ReturnType<typeof _newCraft>> = []

          const found = ingredients.find((e) => e.id === id)
          if (found != null) ingredients = [found]

          // do craft on all ingredients of current recipe
          inner: for (const ing of ingredients) {
            const data = _newCraft({ id: ing.id, count: -ing.count }, candidateOpts, new Map(candidateSeen))
            if (!data.success) continue inner
            results.push(data)

            candidateRecipes.push(...data.recipesToDo)
            applyRecipeResults(currentItems, data.recipesToDo)
          }

          // if we successfully crafted all ingredients, we can craft this recipe
          if (results.length === ingredients.length) {
            // with our available items properly managed now, we can do the standard crafting option.
            let test: { recipesToDo: Array<{ recipeApplications: number, recipe: PRecipe }> } | undefined
            let attemptCount = count - craftedCount
            tester: for (; attemptCount > 0; attemptCount--) {
              const recipeApplications = Math.ceil(attemptCount / recipe.result.count)
              const attemptItems = cloneAvailableItems(currentItems)
              const attemptRecipes = [...candidateRecipes]
              const attemptOpts: CraftOptions = {
                ...candidateOpts,
                availableItems: attemptItems
              }
              const parentInputs = recipeInputs(recipe)
              let pass = 0

              while (!canCraftRecipe(attemptItems, recipe, recipeApplications, itemMatchesIngredient)) {
                let madeProgress = false
                pass++

                if (pass > parentInputs.length * (recipeApplications + 2)) continue tester

                for (const input of parentInputs) {
                  const required = -input.count * recipeApplications
                  const available = availableItemCount(attemptItems, input.id, itemMatchesIngredient)
                  const deficit = required - available

                  if (deficit <= 0) continue

                  const deficitItems = reserveItem(attemptItems, input.id, available, itemMatchesIngredient)
                  const deficitOpts: CraftOptions = {
                    ...attemptOpts,
                    availableItems: deficitItems
                  }
                  const data = _newCraft({ id: input.id, count: deficit }, deficitOpts, new Map(candidateSeen), deficit)
                  if (!data.success || data.recipesToDo.length === 0) continue tester

                  attemptRecipes.push(...data.recipesToDo)
                  replaceItems(attemptItems, deficitItems)
                  if (available > 0) addItem(attemptItems, { id: input.id, count: available })
                  applyRecipeResults(attemptItems, data.recipesToDo)
                  madeProgress = true
                }

                if (!madeProgress) continue tester
              }

              replaceItems(currentItems, attemptItems)
              candidateRecipes.splice(0, candidateRecipes.length, ...attemptRecipes)
              test = { recipesToDo: [{ recipeApplications, recipe }] }
              craftedCount += attemptCount
              break tester
            }

            if (test === undefined) continue outer

            candidateRecipes.push(...test.recipesToDo)
            applyRecipeResults(currentItems, test.recipesToDo)
            if (craftedCount > bestPartialCount) {
              bestPartialCount = craftedCount
              bestPartialRecipes = [...candidateRecipes]
            }

            if (craftedCount !== count) {
              if (multipleRecipes && craftedCount > 0) {
                const remainingSeen = new Map(candidateSeen)
                remainingSeen.delete(id)
                const remainingItems = cloneAvailableItems(currentItems).filter((item) => item.id !== id)
                const data = _newCraft(
                  { id, count: count - craftedCount },
                  {
                    ...opts,
                    availableItems: remainingItems
                  },
                  remainingSeen,
                  count - craftedCount
                )

                if (data.success) {
                  return createPlanResult(
                    true,
                    ret0.concat(data.itemsRequiredBase),
                    candidateRecipes.concat(data.recipesToDo)
                  )
                }
              }

              continue outer
            }

            return createPlanResult(true, ret0, candidateRecipes)
          }
        }

        // TODO can implement partial completion of recipes here.
        const hasNoRecipes = recipes.length === 0
        const weHaveItem = availableItems.find((e) => e.id === id && e.count >= count)
        if (hasNoRecipes && weHaveItem != null) {
          return createPlanResult(true, [], [])
        } else {
          if (bestPartialCount > 0) {
            const partialRequirements = getPartialRequirements(
              id,
              count - bestPartialCount,
              availableItems,
              bestPartialRecipes,
              opts
            )

            return createPlanResult(
              false,
              partialRequirements.itemsRequiredBase,
              bestPartialRecipes,
              undefined,
              partialRequirements.itemsRequiredImmediate,
              partialRequirements.itemsRemaining
            )
          }

          if (!multipleRecipes || (hasNoRecipes && weHaveItem == null)) {
            const new1 = { id, count: count - craftedCount }
            return createPlanResult(false, [new1], [])
          } else {
            const data = _newCraft({ id, count: count - craftedCount }, opts, seen, target)
            return createPlanResult(data.success, ret0.concat(data.itemsRequiredBase), ret1.concat(data.recipesToDo))
          }
        }
      }
    } else {
      // TODO : should be replaced by smelting recipe data
      const found = recipes.find((r) => r.result.count > 1)
      recipeWanted = found ?? recipes[0]

      if (recipes.length === 0) {
        return createPlanResult(true, [item], [])
      }

      if (seen.has(id)) {
        if (!includeRecursion) {
          return createPlanResult(true, [item], [])
        }
        return createPlanResult(true, [item], [])
      }

      seen.set(id, item)
    }

    const recipeApplications = Math.ceil(count / recipeWanted.result.count)

    const items = recipeWanted.delta.slice(0, -1).map((e) => ({ id: e.id, count: -recipeApplications * e.count }))

    const ret = items.reduce(
      (acc, item) => {
        const r = _newCraft(item, opts, seen)
        return {
          success: acc.success && r.success,
          itemsRequiredBase: acc.itemsRequiredBase.concat(r.itemsRequiredBase),
          itemsRequiredImmediate: [],
          itemsRemaining: [],
          itemsCreated: [],
          recipesToDo: r.recipesToDo.concat(acc.recipesToDo)
        }
      },
      {
        success: true,
        itemsRequiredBase: [] as Item[],
        itemsRequiredImmediate: [] as Item[],
        itemsRemaining: [] as Item[],
        itemsCreated: [] as Item[],
        recipesToDo: [{ recipeApplications, recipe: recipeWanted }]
      }
    )

    seen.clear()

    return createPlanResult(ret.success, ret.itemsRequiredBase, ret.recipesToDo)
  }

  function newCraft (
    item: Item,
    opts: CraftOptions = {}
  ): CraftingPlan {
    const seen = new Map()

    // rough, but easy way to patch out items that are already available.
    // can clean up later.
    if (opts.availableItems != null) {
      if (opts.careAboutExisting !== true) {
        const found = opts.availableItems.filter((e) => e.id === item.id)
        for (const f of found) {
          opts.availableItems.splice(opts.availableItems.indexOf(f), 1)
        }
      }

      // normalize items, bug pointed out by Vakore.
      const seen = new Set()
      for (const item of opts.availableItems) {
        if (seen.has(item.id)) {
          opts.availableItems.splice(opts.availableItems.indexOf(item), 1)
          const existing = opts.availableItems.find((e) => e.id === item.id)
          if (existing != null) existing.count += item.count
        }
        seen.add(item.id)
      }
    }

    const ret = _newCraft(item, opts, seen)

    const availableItems = opts.availableItems

    const ret1 = ret as CraftingPlan
    // due to multiple recipes, preserve order of items required.
    if (availableItems !== undefined) {
      if (!isConcretePlanForAvailableItems(ret, availableItems, itemMatchesIngredient)) {
        return newCraft(item, { ...opts, availableItems: undefined })
      }

      ret1.requiresCraftingTable = ret.recipesToDo.some((r) => r.recipe.requiresTable)
      return ret1
    }

    ret.itemsRequiredBase = []
    ret.itemsRequiredImmediate = []
    ret.itemsRemaining = []

    const map: Record<string, number> = {}

    if (opts.includeRecursion !== true) {
      hey: while (ret.recipesToDo.length > 0) {
        // remove single-level loops
        let change = 0
        inner: for (const res1 of ret.recipesToDo) {
          const res = res1.recipe.result
          const res2 = res1.recipe.delta.slice(0, 1)
          const found = ret.recipesToDo.find(
            (r1) =>
              r1 !== res1 &&
              r1.recipe.delta.length === res1.recipe.delta.length &&
              !(r1.recipe.delta.find((i) => i.id !== r1.recipe.result.id && i.id === res.id) == null) &&
              res2.find((i) => i.id === r1.recipe.result.id)
          )
          if (found == null) continue inner

          const consumerIdx = ret.recipesToDo.indexOf(res1)
          ret.recipesToDo.splice(consumerIdx, 1)
          if (ret.recipesToDo.length <= 1) break hey
          const producerIdx = ret.recipesToDo.indexOf(found)
          ret.recipesToDo.splice(producerIdx, 1)
          change++
        }

        if (change === 0) break hey
      }
    } else {
      hey: while (ret.recipesToDo.length > 0) {
        // remove single-level loops

        let change = 0
        inner: for (const res1 of ret.recipesToDo) {
          const res = res1.recipe.result
          const res2 = res1.recipe.delta.slice(0, 1)
          const found = ret.recipesToDo.find(
            (r1) =>
              r1 !== res1 &&
              r1.recipe.delta.length === res1.recipe.delta.length &&
              !(r1.recipe.delta.find((i) => i.id !== r1.recipe.result.id && i.id === res.id) == null) &&
              res2.find((i) => i.id === r1.recipe.result.id)
          )
          // console.log("found loop", !!res1, !!res, found);
          if (found == null) continue inner

          const consumerIdx = ret.recipesToDo.indexOf(res1)
          ret.recipesToDo.splice(consumerIdx, 1)
          change++
          if (ret.recipesToDo.length === 1) break hey
        }

        if (change === 0) break hey
      }
    }

    // console.log(ret.recipesToDo.map((r) => r.recipe.delta.map((i) => [i.count, itemsMap[i.id].name])));
    for (let i = 0; i < ret.recipesToDo.length; i++) {
      const res = ret.recipesToDo[i]
      const recipe = res.recipe
      const recipeApplications = res.recipeApplications
      const delta = recipe.delta
      for (let j = 0; j < delta.length; j++) {
        const ing = delta[j]
        const count = ing.count * recipeApplications

        const val = map[ing.id]
        const nan = isNaN(val)

        if (nan) map[ing.id] = count
        else map[ing.id] += count
      }
    }

    if (ret.recipesToDo.length > 1) {
      for (let idx = 0; idx < ret.recipesToDo.length; idx++) {
        const res = ret.recipesToDo[idx]
        if (res.recipe.result.id === item.id) continue
        const potentialShift = res.recipe.delta.slice(0, -1).some((i) => map[i.id] < 0)
        if (!potentialShift) continue
        const valid = res.recipe.delta.reduce((acc, ing) => (map[ing.id] < 0 ? true : map[ing.id] - ing.count >= 0 && acc), true)
        if (valid) {
          for (const ing of res.recipe.delta) {
            map[ing.id] -= ing.count
          }
          // removed this so users can know when intermediate items are crafted.
          // uncomment to remove blanks.
          // for (const ing of res.recipe.delta) {
          //   const val = map[ing.id];
          //   if (val === 0) delete map[ing.id];
          // }
          ret.recipesToDo.splice(idx, 1)
        }
      }
    }

    for (const [key, val] of Object.entries(map)) {
      const key1 = Number(key)
      if (key1 === item.id) continue
      const required = { id: key1, count: val >= 0 ? 0 : -val }
      ret.itemsRequiredBase.push(required)
      ret.itemsRequiredImmediate.push(required)
    }
    ret1.requiresCraftingTable = ret.recipesToDo.some((r) => r.recipe.requiresTable)
    return ret1
  }

  return newCraft
}

export async function buildStatic (Recipe: typeof PRecipe): Promise<CraftingFunc> {
  return _build(Recipe)
}
