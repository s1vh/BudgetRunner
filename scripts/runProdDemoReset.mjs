import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const backendRequire = createRequire(new URL('../backend/package.json', import.meta.url))
const tsxCli = backendRequire.resolve('tsx/cli')
const resetScript = resolve(projectRoot, 'backend', 'src', 'scripts', 'resetProdDemoUser.ts')
const forwardedArgs = process.argv.slice(2)

// npm consumes its own --dry-run option instead of forwarding it to package scripts.
// With no forwarded arguments, the root command therefore defaults to the safe preview.
const resetArgs = forwardedArgs.length ? forwardedArgs : ['--dry-run']

const result = spawnSync(
  process.execPath,
  [tsxCli, resetScript, ...resetArgs],
  {
    cwd: projectRoot,
    stdio: 'inherit',
  },
)

if (result.error) throw result.error
process.exitCode = result.status ?? 1
