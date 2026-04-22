const { spawnSync } = require('node:child_process')
const path = require('node:path')

const DEFAULT_CASES = [
  { version: '1.8.8', wantedItem: 'wooden_pickaxe', woodItem: 'log' },
  { version: '1.12.2', wantedItem: 'wooden_pickaxe', woodItem: 'log' },
  { version: '1.16.5', wantedItem: 'wooden_pickaxe', woodItem: 'oak_log' },
  { version: '1.18.2', wantedItem: 'wooden_pickaxe', woodItem: 'oak_log' },
  { version: '1.21.4', wantedItem: 'wooden_pickaxe', woodItem: 'oak_log' },
  { version: '1.21.4', wantedItem: 'wooden_pickaxe', woodItem: 'pale_oak_log' },
  { version: '1.21.11', wantedItem: 'wooden_pickaxe', woodItem: 'oak_log' },
  { version: '1.21.11', wantedItem: 'wooden_pickaxe', woodItem: 'pale_oak_log' },
  { version: '1.21.11', wantedItem: 'wooden_pickaxe', woodItem: 'birch_log' }
]

function runCase (testCase, timeoutMs) {
  const result = spawnSync(
    process.execPath,
    [
      path.join(__dirname, 'staticPlanSmoke.js'),
      '--version',
      testCase.version,
      '--wanted-item',
      testCase.wantedItem,
      '--wood-item',
      testCase.woodItem,
      '--timeout-ms',
      String(timeoutMs)
    ],
    {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 10 * 1024 * 1024
    }
  )

  if (result.status !== 0) {
    return {
      ...testCase,
      ok: false,
      error: (result.stderr || result.stdout || '').trim() || `exit ${result.status}`
    }
  }

  try {
    const parsed = JSON.parse(result.stdout)
    return {
      ...testCase,
      ok: true,
      stepCount: parsed.stepCount,
      requiresCraftingTable: parsed.requiresCraftingTable,
      success: parsed.success,
      plan: parsed.plan
    }
  } catch (error) {
    return {
      ...testCase,
      ok: false,
      error: `failed to parse JSON: ${error.message}`,
      raw: result.stdout
    }
  }
}

function main () {
  const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS || 4000)
  const cases = DEFAULT_CASES
  let failed = false

  for (const testCase of cases) {
    const result = runCase(testCase, timeoutMs)

    if (result.ok) {
      console.log(
        `${result.version} ${result.woodItem}: stepCount=${result.stepCount}, table=${result.requiresCraftingTable}, success=${result.success}`
      )
    } else {
      failed = true
      console.log(`${result.version} ${result.woodItem}: FAIL ${result.error}`)
    }
  }

  process.exitCode = failed ? 1 : 0
}

main()
