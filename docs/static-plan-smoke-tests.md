# Static Plan Smoke Tests

Use these scripts when changing `src/craftingInjection.ts`, especially around
`availableItems`, recursive crafting, or alternate recipe ingredients.

The current `1.21.4` wood-ordering investigation is recorded in
[dev-log.md](dev-log.md).

The important property is that each smoke case runs the planner in a child
process with a hard timeout. If a change causes runaway recursion, the child is
killed quickly instead of waiting for Node to exhaust heap memory.

## Before Running

The smoke scripts import `../lib`, not `src`, so rebuild after source edits:

```sh
npm run build
```

## Single Case

Run one static planning case and print the raw JSON summary:

```sh
npm run smoke:static -- --version 1.21.4 --wanted-item wooden_pickaxe --wood-item oak_log --timeout-ms 4000
```

Useful variants:

```sh
npm run smoke:static -- --version 1.21.11 --wood-item oak_log --timeout-ms 4000
npm run smoke:static -- --version 1.21.4 --wood-item pale_oak_log --timeout-ms 4000
npm run smoke:static -- --version 1.21.11 --wood-item pale_oak_log --timeout-ms 4000
npm run smoke:static -- --version 1.21.11 --wood-item birch_log --timeout-ms 4000
```

Arguments:

- `--version`: Minecraft version passed to `minecraft-data`.
- `--wanted-item`: item to craft. Defaults to `wooden_pickaxe`.
- `--wood-item`: initial wood item placed in `availableItems`. Defaults to
  `oak_log` when present, otherwise `log`.
- `--timeout-ms`: child process timeout. Defaults to `5000`.

The JSON summary includes:

- `success`: planner success flag.
- `stepCount`: number of `recipesToDo`.
- `itemsRequired`: returned missing items.
- `requiresCraftingTable`: whether any recipe requires a table.
- `plan`: each recipe result and delta.

## Matrix

Run a fixed set of representative versions and wood variants:

```sh
npm run smoke:matrix
```

Current fixed baseline:

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

Expected behavior for the wooden pickaxe case with two logs available is a
four-step plan:

```txt
log x -1 => planks x 4
planks x -2 => stick x 4
log x -1 => planks x 4
planks x -3, stick x -2 => wooden_pickaxe x 1
```

The `1.21.4+` wood cases should stay at `stepCount=4` without introducing a
timeout.

## Recommended Fix Loop

1. Edit `src/craftingInjection.ts`.
2. Run `npm run build`.
3. Run one focused case with `npm run smoke:static -- --version 1.21.4 --wood-item oak_log --timeout-ms 4000`.
4. Run `npm run smoke:matrix`.
5. Run `npm test` once the smoke cases are stable.

If a smoke command times out, treat it as a recursion bug and inspect the most
recent planner change before running the full test suite.
