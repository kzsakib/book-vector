/**
 * Generates the dataset the app loads into `public/data`.
 *
 * The 50k atlas is built by the offline Python pipeline (deterministic, ~40 s,
 * numpy only). When numpy is unavailable — a bare checkout on a machine without
 * a Python scientific stack — we fall back to the committed-sample generator so
 * `npm run build` still produces a working site.
 */
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const manifest = join(root, 'public', 'data', 'manifest.json')

function run(command, args) {
  execFileSync(command, args, { cwd: root, stdio: 'inherit' })
}

function hasNumpy() {
  try {
    execFileSync('python3', ['-c', 'import numpy'], { cwd: root, stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

const ifMissing = process.argv.includes('--if-missing')
if (ifMissing && existsSync(manifest)) {
  console.log('[data] public/data/manifest.json exists, skipping build')
  process.exit(0)
}

if (hasNumpy()) {
  run('python3', ['pipeline/50k_build.py'])
} else {
  console.warn('[data] numpy not found — falling back to the 2k sample generator')
  run('node', ['scripts/generate-sample.mjs'])
}
