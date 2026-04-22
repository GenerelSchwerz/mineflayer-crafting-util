# Development Log

## 2026-04-22: `stone_pickaxe` fails with `3 cobblestone + 1 oak_log`

### Symptom

The static planner can find a `stone_pickaxe` recipe when no available
inventory is supplied, but fails when the inventory is functionally sufficient:

```txt
availableItems:
  cobblestone x 3
  oak_log x 1
```

This should produce:

```txt
oak_log x -1 => oak_planks x 4
oak_planks x -2 => stick x 4
cobblestone x -3, stick x -2 => stone_pickaxe x 1
```

Instead, the available-items planner returns `success=false` with no recipe
steps.

### Reproduction

Build first because the smoke script imports `../lib`:

```sh
npm run build
```

Then run:

```sh
node scripts/staticPlanSmoke.js --version 1.21.4 --wanted-item stone_pickaxe --available cobblestone:3,oak_log:1 --timeout-ms 4000
```

### Root cause

In Minecraft `1.21.4`, `prismarine-recipe` exposes `stone_pickaxe` recipes with
`recipe.ingredients` as an empty array, while the real inputs are present in
`recipe.delta`.

The available-items planner only checked whether `recipe.ingredients` was
non-null. For an empty array, `every(...)` returned true, so the planner treated
the first `stone_pickaxe` recipe as craftable. That first recipe uses
`cobbled_deepslate`, not `cobblestone`, so later recursive planning could not
produce a valid path from the supplied inventory.

### Fix

Recipe input extraction is now normalized:

1. Use `recipe.ingredients` only when it exists and has entries.
2. Otherwise use the negative entries from `recipe.delta`.
3. Use that normalized input list for available-items recipe matching, scoring,
   and missing-ingredient discovery.

The smoke rig also accepts generic inventory inputs through `--available`, so
cases like this can be reproduced without editing scripts.

## 2026-04-21: `1.21.4` wood recipe ordering and missing plank craft

### Symptom

The static planner produces different plans for equivalent wood inputs in
Minecraft `1.21.4`.

With `oak_log`:

```txt
oak_log x -1 => oak_planks x 4
oak_planks x -2 => stick x 4
oak_planks x -3, stick x -2 => wooden_pickaxe x 1
```

With `pale_oak_log`:

```txt
pale_oak_log x -1 => pale_oak_planks x 4
pale_oak_planks x -2 => stick x 4
pale_oak_log x -1 => pale_oak_planks x 4
pale_oak_planks x -3, stick x -2 => wooden_pickaxe x 1
```

The `oak_log` result is wrong for the current planner model. Two logs are
available, and the wooden pickaxe path consumes five planks total: two planks
for sticks and three planks for the pickaxe. Since one log produces four
planks, the plan must include two log-to-planks crafts.

### Reproduction

Build first because the smoke scripts import `../lib`:

```sh
npm run build
```

Then compare the two inputs:

```sh
node scripts/staticPlanSmoke.js --version 1.21.4 --wood-item oak_log --timeout-ms 4000
node scripts/staticPlanSmoke.js --version 1.21.4 --wood-item pale_oak_log --timeout-ms 4000
```

Or run the matrix:

```sh
npm run smoke:matrix
```

Relevant baseline:

```txt
1.21.4 oak_log: stepCount=3, table=true, success=true
1.21.4 pale_oak_log: stepCount=4, table=true, success=true
```

### Recipe data observed

In `1.21.4`, `prismarine-recipe` returns this order for `wooden_pickaxe`:

```txt
0  pale_oak_planks + stick
1  cherry_planks + stick
2  bamboo_planks + stick
3  mangrove_planks + stick
4  warped_planks + stick
5  crimson_planks + stick
6  dark_oak_planks + stick
7  acacia_planks + stick
8  jungle_planks + stick
9  birch_planks + stick
10 spruce_planks + stick
11 oak_planks + stick
```

`stick` has the same kind of ordering:

```txt
0  pale_oak_planks
1  cherry_planks
2  bamboo_planks
3  mangrove_planks
4  warped_planks
5  crimson_planks
6  dark_oak_planks
7  acacia_planks
8  jungle_planks
9  birch_planks
10 spruce_planks
11 oak_planks
12 bamboo
```

The plank recipes themselves are structurally equivalent:

```txt
oak_log x -1 => oak_planks x 4
pale_oak_log x -1 => pale_oak_planks x 4
```

So this is not caused by a special pale-oak recipe. It is caused by recipe
ordering interacting with the planner.

### Root cause

The `availableItems` branch in `src/craftingInjection.ts` is order-dependent
and mutates `opts.availableItems` while exploring candidate recipes.

The relevant code first calculates recipe scores:

```ts
const deltas = recipes
  .map((recipe) => recipe.delta.slice(0, -1).map((e) => ({ id: e.id, count: -e.count })))
  .map(
    (delta) =>
      availableItems.filter((have) => delta.findIndex((wanted) => wanted.id === have.id && wanted.count <= have.count) !== -1)
        .length
  );
```

Then it sorts only the numeric scores:

```ts
deltas.sort((a, b) => b - a);
```

But later uses those sorted score indexes against the original recipe array:

```ts
for (let i = 0; i < deltas.length; i++) {
  if (deltas[i] !== mostAmt) continue;
  const recipe = recipes1[i];
}
```

This loses the relationship between a score and the recipe it came from.

At the same time, recursive candidate probing applies recipe results into
`opts.availableItems`. When earlier candidate recipes are explored and fail or
partially succeed, intermediate inventory can leak into later candidate checks.
The planner can then accept a final parent recipe after recording only one
log-to-planks craft, even though the intermediate planks were consumed by a
sibling ingredient (`stick`) and the parent still needs three planks.

Why `pale_oak_log` appears correct in `1.21.4`:

`pale_oak_planks` is the first pickaxe recipe and the first stick recipe in
that version. The current order bias happens to choose the same wood family as
the provided input, so the bug is masked and the second planks craft is
recorded.

Why `oak_log` appears wrong:

`oak_planks` is last in the recipe order. The planner walks through earlier
non-oak candidate recipes first, mutating shared `availableItems` during
recursive attempts, then accepts an oak path with incomplete accounting for the
second plank craft.

### Fix implemented

The fix avoids special-casing oak or pale oak. The underlying issue was planner
state management.

Implemented changes:

1. Keep recipe scores paired with recipes.

   The planner now builds `{ recipe, score }` objects and sorts those objects.
   It no longer sorts numeric scores and then uses those sorted indexes against
   the original recipe list.

2. Make candidate evaluation transactional.

   Each attempted recipe now receives a cloned `availableItems` array and a
   cloned `seen` map. Recursive probes mutate only that candidate state. Failed
   or partial candidates no longer leak crafted intermediates into later
   candidates.

3. Preserve existing recursive reconciliation.

   Once the correct candidate owns an isolated inventory state, the existing
   recursive parent retry can see the real post-stick deficit and emits the
   second log-to-planks craft. This avoids adding a new open-ended repair loop.

4. Keep regression coverage focused on the smoke matrix and Mocha suite.

   The `1.21.4 oak_log` and `1.21.4 pale_oak_log` wooden-pickaxe smoke cases
   both produce `stepCount=4`. The full matrix completes without timeout.

### Verification results

Commands run:

```sh
npm run build
node scripts/staticPlanSmoke.js --version 1.21.4 --wood-item oak_log --timeout-ms 4000
node scripts/staticPlanSmoke.js --version 1.21.4 --wood-item pale_oak_log --timeout-ms 4000
node scripts/staticPlanSmoke.js --version 1.21.11 --wood-item oak_log --timeout-ms 4000
node scripts/staticPlanSmoke.js --version 1.18.2 --wood-item oak_log --timeout-ms 4000
npm run smoke:matrix
npm test
```

Smoke matrix after the fix:

```txt
1.8.8 log: stepCount=4, table=true, success=true
1.12.2 log: stepCount=4, table=true, success=true
1.16.5 oak_log: stepCount=4, table=true, success=true
1.18.2 oak_log: stepCount=4, table=true, success=true
1.21.4 oak_log: stepCount=4, table=true, success=true
1.21.4 pale_oak_log: stepCount=4, table=true, success=true
1.21.11 oak_log: stepCount=4, table=true, success=true
1.21.11 pale_oak_log: stepCount=4, table=true, success=true
1.21.11 birch_log: stepCount=4, table=true, success=true
```

Mocha result:

```txt
4 passing
```

`ts-standard` now has scoped package scripts:

```sh
npm run lint
npm run fix-lint
```

Both commands target `src/**/*.ts`. The CommonJS smoke scripts and Mocha tests
are intentionally excluded from the TypeScript source lint target.

### Guardrails

Use the smoke scripts before `npm test` while working on this area:

```sh
npm run build
node scripts/staticPlanSmoke.js --version 1.21.4 --wood-item oak_log --timeout-ms 4000
npm run smoke:matrix
```

If a smoke run times out, stop and inspect the recursion change. Do not wait for
the full test suite or a heap crash to diagnose planner loops.
