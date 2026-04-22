const { spawn } = require('node:child_process')
const path = require('node:path')

const DEFAULT_TIMEOUT_MS = 5000

function parseArgs (argv) {
  const args = {
    version: process.env.MC_VERSION || '1.21.4',
    wantedItem: 'wooden_pickaxe',
    wantedCount: Number(process.env.WANTED_COUNT || 1),
    woodItem: process.env.WOOD_ITEM || null,
    available: process.env.AVAILABLE_ITEMS || null,
    timeoutMs: DEFAULT_TIMEOUT_MS
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--version') args.version = argv[++i]
    else if (arg === '--wanted-item') args.wantedItem = argv[++i]
    else if (arg === '--wanted-count') args.wantedCount = Number(argv[++i])
    else if (arg === '--wood-item') args.woodItem = argv[++i]
    else if (arg === '--available') args.available = argv[++i]
    else if (arg === '--timeout-ms') args.timeoutMs = Number(argv[++i])
  }

  return args
}

function parseAvailableItems (mcData, value) {
  if (value == null || value === '') return null

  return value.split(',').map((entry) => {
    const [name, countText] = entry.split(':')
    const item = mcData.itemsByName[name]
    const count = Number(countText)

    if (item == null) {
      throw new Error(`Unknown available item: ${name}`)
    }

    if (!Number.isInteger(count) || count <= 0) {
      throw new Error(`Invalid available item count for ${name}: ${countText}`)
    }

    return { id: item.id, count }
  })
}

async function runChild () {
  const mcData = require('minecraft-data')(process.env.MC_VERSION)
  const { buildStatic } = require('../lib')

  const crafter = await buildStatic(mcData)
  const wanted = mcData.itemsByName[process.env.WANTED_ITEM]
  const wantedCount = Number(process.env.WANTED_COUNT || 1)
  if (wanted == null) {
    throw new Error(`Unknown wanted item: ${process.env.WANTED_ITEM}`)
  }
  if (!Number.isInteger(wantedCount) || wantedCount <= 0) {
    throw new Error(`Invalid wanted count: ${process.env.WANTED_COUNT}`)
  }

  const availableItems = parseAvailableItems(mcData, process.env.AVAILABLE_ITEMS)
  let woodItemName = process.env.WOOD_ITEM || null
  let finalAvailableItems = availableItems

  if (finalAvailableItems == null) {
    woodItemName = woodItemName || (mcData.itemsByName.oak_log != null ? 'oak_log' : 'log')
    const wood = mcData.itemsByName[woodItemName]
    if (wood == null) {
      throw new Error(`Unknown wood item: ${woodItemName}`)
    }
    finalAvailableItems = [{ id: wood.id, count: 2 }]
  }

  const plan = crafter(
    { id: wanted.id, count: wantedCount },
    {
      availableItems: finalAvailableItems,
      multipleRecipes: true
    }
  )

  const summary = {
    version: process.env.MC_VERSION,
    wantedItem: process.env.WANTED_ITEM,
    wantedCount,
    woodItem: woodItemName,
    availableItems: finalAvailableItems.map((item) => ({
      name: mcData.items[item.id].name,
      count: item.count
    })),
    success: plan.success,
    stepCount: plan.recipesToDo.length,
    itemsRequired: plan.itemsRequired,
    requiresCraftingTable: plan.requiresCraftingTable,
    plan: plan.recipesToDo.map(({ recipeApplications, recipe }) => ({
      recipeApplications,
      result: recipe.result,
      delta: recipe.delta
    }))
  }

  process.stdout.write(JSON.stringify(summary, null, 2))
}

async function runParent () {
  const args = parseArgs(process.argv.slice(2))
  const childEnv = {
    ...process.env,
    PLAN_SMOKE_CHILD: '1',
    MC_VERSION: args.version,
    WANTED_ITEM: args.wantedItem,
    WANTED_COUNT: String(args.wantedCount),
    WOOD_ITEM: args.woodItem || '',
    AVAILABLE_ITEMS: args.available || ''
  }

  const child = spawn(process.execPath, [path.join(__dirname, 'staticPlanSmoke.js')], {
    env: childEnv,
    stdio: ['ignore', 'pipe', 'pipe']
  })

  let stdout = ''
  let stderr = ''

  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString('utf8')
  })

  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString('utf8')
  })

  const timer = setTimeout(() => {
    child.kill('SIGKILL')
    process.stderr.write(
      `staticPlanSmoke timed out after ${args.timeoutMs}ms for ${args.version} (${args.wantedItem})\n`
    )
    process.exitCode = 1
  }, args.timeoutMs)

  child.on('close', (code, signal) => {
    clearTimeout(timer)

    if (signal === 'SIGKILL' && process.exitCode === 1) {
      return
    }

    if (code !== 0) {
      process.stderr.write(stderr || `staticPlanSmoke failed with code ${code}\n`)
      process.exit(code ?? 1)
      return
    }

    process.stdout.write(stdout)
  })
}

if (process.env.PLAN_SMOKE_CHILD === '1') {
  runChild().catch((error) => {
    process.stderr.write(`${error.stack || error.message}\n`)
    process.exit(1)
  })
} else {
  runParent().catch((error) => {
    process.stderr.write(`${error.stack || error.message}\n`)
    process.exit(1)
  })
}
