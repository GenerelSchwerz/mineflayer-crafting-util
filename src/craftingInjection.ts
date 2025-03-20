import type { Bot, BotOptions } from "mineflayer";
import type { Recipe as PRecipe } from "prismarine-recipe";
import type { CraftOptions, Item } from "./types";
import type { CraftingPlan } from "./types";

const gettableItems = [263, 264, 265, 266, 296, 331, 341, 388]; // TODO : should be replaced by smelting recipe data

type CraftingFunc = (item: Item, opts?: CraftOptions) => CraftingPlan

export function _build(Recipe: typeof PRecipe): CraftingFunc {

  function _newCraft(
    item: Item,
    opts: CraftOptions = {},
    seen = new Map(),
    target = item.count
  ): { success: boolean; itemsRequired: Item[]; recipesToDo: Array<{ recipeApplications: number; recipe: PRecipe }> } {
    const id = item.id;
    const recipes = Recipe.find(id, null);

    const availableItems = opts.availableItems;
    const includeRecursion = opts.includeRecursion ?? false;
    const multipleRecipes = opts.multipleRecipes ?? false;

    let matchingItem;
    let recipeWanted;

    let count = item.count;

    const ret0: Item[] = [];
    const ret1: Array<{
      recipeApplications: number;
      recipe: PRecipe;
    }> = [];

    if (availableItems !== undefined) {
      matchingItem = availableItems.find((e) => e.id === id && e.count >= target);
      if (matchingItem != null) {
        if (matchingItem.count >= target) {
          return { success: true, itemsRequired: [], recipesToDo: [] }; // already have item, no need to craft it.
        } else {
          count -= matchingItem.count;
        }
      }

      if (recipes.length == 0 || gettableItems.includes(id)) {
        return { success: true, itemsRequired: [item], recipesToDo: [] };
      }


      if (seen.has(id)) {
        return { success: false, itemsRequired: [item], recipesToDo: [] };
      }

      seen.set(id, item);

      recipeWanted = recipes.find((r) =>
        r.delta.slice(0, -1).every((e) => (availableItems.find((i) => i.id === e.id)?.count ?? 0) >= -e.count)
      );

      if (recipeWanted != null) {
      } else {
        // since no recipes exist with all items available, search for the recipe with the most amount of items available inline
        
        const recipes1 = recipes;

        const deltas = recipes
          .map((recipe) => recipe.delta.slice(0, -1).map((e) => ({ id: e.id, count: -e.count })))
          .map(
            (delta) =>
              availableItems.filter((have) => delta.findIndex((wanted) => wanted.id === have.id && wanted.count <= have.count) !== -1)
                .length
          );

        deltas.sort((a, b) => b - a);

        const mostAmt = Math.max(...deltas);

        // store current amount of items available to be crafted
        let craftedCount = 0;

        outer: for (let i = 0; i < deltas.length; i++) {
          if (deltas[i] !== mostAmt) continue;

          // we are going to recurse downwards, so we need to remove items from availableItems as we use them.
          const currentItems = opts.availableItems!;
          const recipe = recipes1[i];
          const ingredien = recipe.delta.slice(0, -1);

          // all items that need to be crafted to craft this recipe
          let ingredients = ingredien.filter((i) => availableItems.find((e) => e.id === i.id && e.count >= -i.count) === undefined);

          // store all results for crafting attempts on all ingredients of current recipe
          const results: Array<ReturnType<typeof _newCraft>> = [];

          const found = ingredients.find((e) => e.id === id);
          if (found != null) ingredients = [found];

          // do craft on all ingredients of current recipe
          inner: for (const ing of ingredients) {
            const data = _newCraft({ id: ing.id, count: -ing.count }, opts, seen);
            if (!data.success) continue inner;
            results.push(data);

            ret1.push(...data.recipesToDo);

            for (const item1 of data.recipesToDo) {
              for (let j = 0; j < item1.recipe.delta.length; j++) {
                const item = item1.recipe.delta[j];
                const index = currentItems.findIndex((e) => e.id === item.id);
                if (index !== -1) {
                  currentItems[index].count += item.count * item1.recipeApplications;
                } else {
                  currentItems.push({ id: item.id, count: item.count * item1.recipeApplications });
                }
              }
            }
          }

          // if we successfully crafted all ingredients, we can craft this recipe
          if (results.length === ingredients.length) {

            // with our available items properly managed now, we can do the standard crafting option.
            let test;
            let attemptCount = count - craftedCount;
            tester: for (; attemptCount > 0; attemptCount--) {
              const newopts = opts;
              const test1 = _newCraft({ id, count: attemptCount }, newopts, seen, target);
              if (test1.success) {
                test = test1;
                craftedCount += attemptCount;
                break tester;
              }
            }

            if (test === undefined) continue outer;

            ret1.push(...test.recipesToDo);

            for (const toDo of test.recipesToDo) {
              for (const ing of toDo.recipe.delta) {
                const index = currentItems.findIndex((e) => e.id === ing.id);
                const num = (currentItems[index]?.count ?? 0) + ing.count * toDo.recipeApplications;
                if (num < 0) { // this should never happen, but just in case.
                  return { success: false, itemsRequired: [item], recipesToDo: [] };
                }
                if (index !== -1) {
                  currentItems[index].count += ing.count * toDo.recipeApplications;
                } else {
                  currentItems.push({ id: ing.id, count: ing.count * toDo.recipeApplications });
                }
              }
            }

            if (craftedCount !== count) {
              continue outer;
            }

            return {
              success: true,
              itemsRequired: ret0,
              recipesToDo: ret1,
            };
          }
        }

        // TODO can implement partial completion of recipes here.
        if (!recipeWanted) {
          const hasNoRecipes = recipes.length == 0 || gettableItems.includes(id);
          const weHaveItem = availableItems.find((e) => e.id === id && e.count >= count);
          if (hasNoRecipes && weHaveItem != null) {
            return { success: true, itemsRequired: [], recipesToDo: [] };
          } else {
            if (!multipleRecipes || (hasNoRecipes && weHaveItem == null)) {
              const new1 = { id, count: count - craftedCount };
              return { success: false, itemsRequired: [new1], recipesToDo: [] };
            } else {
              const data = _newCraft({ id, count: count - craftedCount }, opts, seen, target);
              return {
                success: data.success,
                itemsRequired: ret0.concat(data.itemsRequired),
                recipesToDo: ret1.concat(data.recipesToDo),
              };
            }
          }
        }
      }
    } else {
      // TODO : should be replaced by smelting recipe data

      const found = recipes.find((r) => r.result.count > 1);
      recipeWanted = found ?? recipes[0];

      if (recipes.length == 0 || gettableItems.includes(id)) {
        return { success: true, itemsRequired: [item], recipesToDo: [] };
      }

      if (seen.has(id)) {
        if (!includeRecursion) {
          return { success: true, itemsRequired: [item], recipesToDo: [] };
        }
        return { success: true, itemsRequired: [item], recipesToDo: [] };
      }

      seen.set(id, item);
    }

    const recipeApplications = Math.ceil(count / recipeWanted.result.count);

    const items = recipeWanted.delta.slice(0, -1).map((e) => ({ id: e.id, count: -recipeApplications * e.count }));

    const ret = items.reduce(
      (acc, item) => {
        const r = _newCraft(item, opts, seen);
        return {
          success: acc.success && r.success,
          itemsRequired: acc.itemsRequired.concat(r.itemsRequired),
          recipesToDo: r.recipesToDo.concat(acc.recipesToDo),
        };
      },
      { success: true, itemsRequired: [] as Item[], recipesToDo: [{ recipeApplications, recipe: recipeWanted }] }
    );

    seen.clear();

    return ret;
  }

  function newCraft(
    item: Item,
    opts: CraftOptions = {}
  ): CraftingPlan {
    const seen = new Map();

    // rough, but easy way to patch out items that are already available.
    // can clean up later.
    if (!!opts.availableItems) {

      if (!opts.careAboutExisting) {
        const found = opts.availableItems.filter((e) => e.id === item.id);
        for (const f of found) {
            opts.availableItems.splice(opts.availableItems.indexOf(f), 1);
        }
      }

      // normalize items, bug pointed out by Vakore.
      const seen = new Set();
      for (const item of opts.availableItems) {
        if (seen.has(item.id)) {
          opts.availableItems.splice(opts.availableItems.indexOf(item), 1);
          opts.availableItems.find((e) => e.id === item.id)!.count += item.count; 
        }
        seen.add(item.id);
      }
    }


    const ret = _newCraft(item, opts, seen);

    const availableItems = opts.availableItems;

    const ret1 = ret as CraftingPlan;
    // due to multiple recipes, preserve order of items required.
    if (availableItems !== undefined) {
      ret1.requiresCraftingTable = ret.recipesToDo.some((r) => r.recipe.requiresTable);
      return ret1;
    }

    ret.itemsRequired = [];

    const map: Record<string, number> = {};

    if (!opts.includeRecursion) {
      hey: while (ret.recipesToDo.length > 0) {
        // remove single-level loops
        let change = 0;
        inner: for (const res1 of ret.recipesToDo) {
          const res = res1.recipe.result;
          const res2 = res1.recipe.delta.slice(0, 1);
          const found = ret.recipesToDo.find(
            (r1) =>
              r1 !== res1 &&
              r1.recipe.delta.length === res1.recipe.delta.length &&
              !(r1.recipe.delta.find((i) => i.id !== r1.recipe.result.id && i.id === res.id) == null) &&
              res2.find((i) => i.id === r1.recipe.result.id)
          );
          if (found == null) continue inner;

          const consumerIdx = ret.recipesToDo.indexOf(res1);
          ret.recipesToDo.splice(consumerIdx, 1);
          if (ret.recipesToDo.length <= 1) break hey;
          const producerIdx = ret.recipesToDo.indexOf(found);
          ret.recipesToDo.splice(producerIdx, 1);
          change++;
        }

        if (change === 0) break hey;
      }
    } else {
      hey: while (ret.recipesToDo.length > 0) {
        // remove single-level loops

        let change = 0;
        inner: for (const res1 of ret.recipesToDo) {
          const res = res1.recipe.result;
          const res2 = res1.recipe.delta.slice(0, 1);
          const found = ret.recipesToDo.find(
            (r1) =>
              r1 !== res1 &&
              r1.recipe.delta.length === res1.recipe.delta.length &&
              !(r1.recipe.delta.find((i) => i.id !== r1.recipe.result.id && i.id === res.id) == null) &&
              res2.find((i) => i.id === r1.recipe.result.id)
          );
          // console.log("found loop", !!res1, !!res, found);
          if (found == null) continue inner;

          const consumerIdx = ret.recipesToDo.indexOf(res1);
          ret.recipesToDo.splice(consumerIdx, 1);
          change++;
          if (ret.recipesToDo.length === 1) break hey;
        }

        if (change === 0) break hey;
      }
    }

    // console.log(ret.recipesToDo.map((r) => r.recipe.delta.map((i) => [i.count, itemsMap[i.id].name])));
    for (let i = 0; i < ret.recipesToDo.length; i++) {
      const res = ret.recipesToDo[i];
      const recipe = res.recipe;
      const recipeApplications = res.recipeApplications;
      const delta = recipe.delta;
      for (let j = 0; j < delta.length; j++) {
        const ing = delta[j];
        const count = ing.count * recipeApplications;

        const val = map[ing.id];
        const nan = isNaN(val);

        if (nan) map[ing.id] = count;
        else map[ing.id] += count;
      }
    }

    if (ret.recipesToDo.length > 1) {
      for (let idx = 0; idx < ret.recipesToDo.length; idx++) {
        const res = ret.recipesToDo[idx];
        if (res.recipe.result.id === item.id) continue;
        const potentialShift = res.recipe.delta.slice(0, -1).some((i) => map[i.id] < 0);
        if (!potentialShift) continue;
        const valid = res.recipe.delta.reduce((acc, ing) => (map[ing.id] < 0 ? true : map[ing.id] - ing.count >= 0 && acc), true);
        if (valid) {
          for (const ing of res.recipe.delta) {
            map[ing.id] -= ing.count;
          }
          // removed this so users can know when intermediate items are crafted.
          // uncomment to remove blanks.
          // for (const ing of res.recipe.delta) {
          //   const val = map[ing.id];
          //   if (val === 0) delete map[ing.id];
          // }
          ret.recipesToDo.splice(idx, 1);
        }
      }
    }

    for (const [key, val] of Object.entries(map)) {
      const key1 = Number(key);
      if (key1 === item.id) continue;
      ret.itemsRequired.push({ id: key1, count: val >= 0 ? 0 : -val });
    }
    ret1.requiresCraftingTable = ret.recipesToDo.some((r) => r.recipe.requiresTable);
    return ret1;
  }


  return newCraft;
}


export async function injectBot(bot: Bot, botoptions: BotOptions): Promise<void> {
  const Recipe = (await import("prismarine-recipe")).default(bot.version).Recipe;
  const newCraft = _build(Recipe)

  bot.planCraft = newCraft;


  function craftWithInventory(wantedItem: Item) {
    const items = bot.inventory.slots.filter(i=>!!i).map(i=>{return{id: i!.type, count: i!.count}})
    return newCraft(wantedItem, {
      availableItems: items,
      careAboutExisting: false,
      includeRecursion: true,
      multipleRecipes: true
    })

  }

  bot.planCraftInventory = craftWithInventory

}

export async function buildStatic(mcVersion: string): Promise<CraftingFunc> {
  const Recipe = (await import("prismarine-recipe")).default(mcVersion).Recipe;
  return _build(Recipe)
}