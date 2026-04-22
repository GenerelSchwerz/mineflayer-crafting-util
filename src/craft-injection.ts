/* eslint-disable no-labels */
import type { Recipe as PRecipe } from 'prismarine-recipe'
import type { CraftOptions, Item, CraftingPlan } from './types'

import type { IndexedData } from 'minecraft-data'

const gettableItems = [263, 264, 265, 266, 296, 331, 341, 388] // TODO : should be replaced by smelting recipe data

type CraftingFunc = (item: Item, opts?: CraftOptions) => CraftingPlan

function recipeInputs (recipe: PRecipe): Item[] {
  if (recipe.ingredients != null && recipe.ingredients.length > 0) return recipe.ingredients
  return recipe.delta.filter((item) => item.count < 0)
}

export function _build (Recipe: typeof PRecipe): CraftingFunc {
  function _newCraft (
    item: Item,
    opts: CraftOptions = {},
    seen = new Map(),
    target = item.count
  ): { success: boolean, itemsRequired: Item[], recipesToDo: Array<{ recipeApplications: number, recipe: PRecipe }> } {
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
      matchingItem = availableItems.find((e) => e.id === id && e.count >= target)
      if (matchingItem != null) {
        if (matchingItem.count >= target) {
          return { success: true, itemsRequired: [], recipesToDo: [] } // already have item, no need to craft it.
        } else {
          count -= matchingItem.count
        }
      }

      if (recipes.length === 0 || gettableItems.includes(id)) {
        return { success: true, itemsRequired: [item], recipesToDo: [] }
      }

      if (seen.has(id)) {
        return { success: false, itemsRequired: [item], recipesToDo: [] }
      }

      seen.set(id, item)

      recipeWanted = recipes.find((r) =>
        recipeInputs(r).every((e) => (availableItems.find((i) => i.id === e.id)?.count ?? 0) >= -e.count)
      )

      if (recipeWanted == null) {
        // since no recipes exist with all items available, search for the recipe with the most amount of items available inline

        const scoredRecipes = recipes
          .map((recipe) => {
            const ingredients = recipeInputs(recipe).map((e) => ({ id: e.id, count: -e.count }))
            const score = availableItems.filter(
              (have) => ingredients.findIndex((wanted) => wanted.id === have.id && wanted.count <= have.count) !== -1
            ).length

            return { recipe, score }
          })
          .sort((a, b) => b.score - a.score)

        const mostAmt = scoredRecipes[0]?.score ?? 0

        // store current amount of items available to be crafted
        let craftedCount = 0

        outer: for (const scoredRecipe of scoredRecipes) {
          if (scoredRecipe.score !== mostAmt) continue

          // Candidate planning mutates inventory counts, so isolate attempts until one fully succeeds.
          const candidateItems = availableItems.map((item) => ({ ...item }))
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
          let ingredients = recipeIngredients.filter((i) => currentItems.find((e) => e.id === i.id && e.count >= -i.count) === undefined)

          // store all results for crafting attempts on all ingredients of current recipe
          const results: Array<ReturnType<typeof _newCraft>> = []

          const found = ingredients.find((e) => e.id === id)
          if (found != null) ingredients = [found]

          // do craft on all ingredients of current recipe
          inner: for (const ing of ingredients) {
            const data = _newCraft({ id: ing.id, count: -ing.count }, candidateOpts, candidateSeen)
            if (!data.success) continue inner
            results.push(data)

            candidateRecipes.push(...data.recipesToDo)

            for (const item1 of data.recipesToDo) {
              for (let j = 0; j < item1.recipe.delta.length; j++) {
                const item = item1.recipe.delta[j]
                const index = currentItems.findIndex((e) => e.id === item.id)
                if (index !== -1) {
                  currentItems[index].count += item.count * item1.recipeApplications
                } else {
                  currentItems.push({ id: item.id, count: item.count * item1.recipeApplications })
                }
              }
            }
          }

          // if we successfully crafted all ingredients, we can craft this recipe
          if (results.length === ingredients.length) {
            // with our available items properly managed now, we can do the standard crafting option.
            let test
            let attemptCount = count - craftedCount
            tester: for (; attemptCount > 0; attemptCount--) {
              const test1 = _newCraft({ id, count: attemptCount }, candidateOpts, candidateSeen, target)
              if (test1.success) {
                test = test1
                craftedCount += attemptCount
                break tester
              }
            }

            if (test === undefined) continue outer

            candidateRecipes.push(...test.recipesToDo)

            for (const toDo of test.recipesToDo) {
              for (const ing of toDo.recipe.delta) {
                const index = currentItems.findIndex((e) => e.id === ing.id)
                // const num = (currentItems[index]?.count ?? 0) + ing.count * toDo.recipeApplications;
                // if (num < 0) { // this should never happen, but just in case.
                //   return { success: false, itemsRequired: [item], recipesToDo: [] };
                // }
                if (index !== -1) {
                  currentItems[index].count += ing.count * toDo.recipeApplications
                } else {
                  currentItems.push({ id: ing.id, count: ing.count * toDo.recipeApplications })
                }
              }
            }

            if (craftedCount !== count) {
              continue outer
            }

            return {
              success: true,
              itemsRequired: ret0,
              recipesToDo: candidateRecipes
            }
          }
        }

        // TODO can implement partial completion of recipes here.
        const hasNoRecipes = recipes.length === 0 || gettableItems.includes(id)
        const weHaveItem = availableItems.find((e) => e.id === id && e.count >= count)
        if (hasNoRecipes && weHaveItem != null) {
          return { success: true, itemsRequired: [], recipesToDo: [] }
        } else {
          if (!multipleRecipes || (hasNoRecipes && weHaveItem == null)) {
            const new1 = { id, count: count - craftedCount }
            return { success: false, itemsRequired: [new1], recipesToDo: [] }
          } else {
            const data = _newCraft({ id, count: count - craftedCount }, opts, seen, target)
            return {
              success: data.success,
              itemsRequired: ret0.concat(data.itemsRequired),
              recipesToDo: ret1.concat(data.recipesToDo)
            }
          }
        }
      }
    } else {
      // TODO : should be replaced by smelting recipe data
      const found = recipes.find((r) => r.result.count > 1)
      recipeWanted = found ?? recipes[0]

      if (recipes.length === 0 || gettableItems.includes(id)) {
        return { success: true, itemsRequired: [item], recipesToDo: [] }
      }

      if (seen.has(id)) {
        if (!includeRecursion) {
          return { success: true, itemsRequired: [item], recipesToDo: [] }
        }
        return { success: true, itemsRequired: [item], recipesToDo: [] }
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
          itemsRequired: acc.itemsRequired.concat(r.itemsRequired),
          recipesToDo: r.recipesToDo.concat(acc.recipesToDo)
        }
      },
      { success: true, itemsRequired: [] as Item[], recipesToDo: [{ recipeApplications, recipe: recipeWanted }] }
    )

    seen.clear()

    return ret
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
      ret1.requiresCraftingTable = ret.recipesToDo.some((r) => r.recipe.requiresTable)
      return ret1
    }

    ret.itemsRequired = []

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
      ret.itemsRequired.push({ id: key1, count: val >= 0 ? 0 : -val })
    }
    ret1.requiresCraftingTable = ret.recipesToDo.some((r) => r.recipe.requiresTable)
    return ret1
  }

  return newCraft
}

export async function buildStatic (registry: IndexedData): Promise<CraftingFunc> {
  // @ts-expect-error
  const Recipe = (await import('prismarine-recipe')).default(registry).Recipe
  return _build(Recipe)
}
