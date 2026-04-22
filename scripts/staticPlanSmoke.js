const { spawn } = require('node:child_process')
const path = require('node:path')

const DEFAULT_TIMEOUT_MS = 5000

function parseArgs (argv) {
  const args = {
    version: process.env.MC_VERSION || '1.21.4',
    wantedItem: 'wooden_pickaxe',
    woodItem: process.env.WOOD_ITEM || null,
    timeoutMs: DEFAULT_TIMEOUT_MS
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--version') args.version = argv[++i]
    else if (arg === '--wanted-item') args.wantedItem = argv[++i]
    else if (arg === '--wood-item') args.woodItem = argv[++i]
    else if (arg === '--timeout-ms') args.timeoutMs = Number(argv[++i])
  }

  return args
}

async function runChild () {
  const mcData = require('minecraft-data')(process.env.MC_VERSION)
  const { buildStatic } = require('../lib')

  const crafter = await buildStatic(mcData)
  const wanted = mcData.itemsByName[process.env.WANTED_ITEM]
  if (wanted == null) {
    throw new Error(`Unknown wanted item: ${process.env.WANTED_ITEM}`)
  }

  const woodItemName =
    process.env.WOOD_ITEM ||
    (mcData.itemsByName.oak_log != null ? 'oak_log' : 'log')
  const wood = mcData.itemsByName[woodItemName]
  if (wood == null) {
    throw new Error(`Unknown wood item: ${woodItemName}`)
  }

  const plan = crafter(
    { id: wanted.id, count: 1 },
    {
      availableItems: [{ id: wood.id, count: 2 }],
      multipleRecipes: true
    }
  )

  const summary = {
    version: process.env.MC_VERSION,
    wantedItem: process.env.WANTED_ITEM,
    woodItem: woodItemName,
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
    WOOD_ITEM: args.woodItem || ''
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
