/**
 * A migration budget: count what you are removing, and refuse to let it grow.
 *
 * The budget file records `<path>\t<token>\t<count>` for every remaining
 * occurrence. Any run that finds more than the budget allows fails. A run that
 * finds fewer says so and leaves the file alone -- `--update` is the only way
 * the budget changes, so a reduction is always a reviewed commit.
 *
 *   bun scripts/budget.ts            compare against the budget
 *   bun scripts/budget.ts --update   record the current counts
 *   bun scripts/budget.ts --report   print the summary, exit 0
 */

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

interface Config {
  include: string[]
  extensions: string[]
  baseline: string
  title: string
  tokens: Record<string, string>
}

type Counts = Map<string, number> // `${path}\t${token}` -> count

const ROOT = resolve(import.meta.dirname, '..')
const CONFIG_PATH = join(ROOT, 'budget.config.json')

function loadConfig(): Config {
  return JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) as Config
}

function walk(dir: string, extensions: string[], out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, extensions, out)
    else if (extensions.some((ext) => entry.endsWith(ext))) out.push(full)
  }
  return out
}

function measure(config: Config): Counts {
  const patterns = Object.entries(config.tokens).map(
    ([token, source]) => [token, new RegExp(source, 'g')] as const,
  )
  const counts: Counts = new Map()

  for (const root of config.include) {
    for (const file of walk(join(ROOT, root), config.extensions)) {
      const source = readFileSync(file, 'utf8')
      const path = relative(ROOT, file)
      for (const [token, pattern] of patterns) {
        const hits = source.match(pattern)?.length ?? 0
        if (hits > 0) counts.set(`${path}\t${token}`, hits)
      }
    }
  }
  return counts
}

function render(config: Config, counts: Counts): string {
  const header = [
    `# ${config.title}`,
    '# Format: <path>\\t<token>\\t<count>. Generated; do not hand-edit.',
    '# Record a reduction with: bun scripts/budget.ts --update',
  ]
  const rows = [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, count]) => `${key}\t${count}`)
  return [...header, ...rows].join('\n') + '\n'
}

function parse(text: string): Counts {
  const counts: Counts = new Map()
  for (const line of text.split('\n')) {
    if (!line || line.startsWith('#')) continue
    const parts = line.split('\t')
    if (parts.length !== 3) continue
    counts.set(`${parts[0]}\t${parts[1]}`, Number(parts[2]))
  }
  return counts
}

function summarise(counts: Counts): { total: number; files: number; byToken: Map<string, number> } {
  const byToken = new Map<string, number>()
  const files = new Set<string>()
  for (const [key, count] of counts) {
    const [path, token] = key.split('\t')
    files.add(path)
    byToken.set(token, (byToken.get(token) ?? 0) + count)
  }
  return { total: [...counts.values()].reduce((a, b) => a + b, 0), files: files.size, byToken }
}

function printSummary(counts: Counts): void {
  const { total, files, byToken } = summarise(counts)
  const width = Math.max(...[...byToken.keys()].map((k) => k.length), 5)
  for (const [token, count] of [...byToken.entries()].sort(([, a], [, b]) => b - a)) {
    console.log(`  ${token.padEnd(width)}  ${String(count).padStart(4)}`)
  }
  console.log(`  ${'─'.repeat(width + 6)}`)
  console.log(`  ${'total'.padEnd(width)}  ${String(total).padStart(4)}  in ${files} files`)
}

function main(): number {
  const config = loadConfig()
  const budgetPath = join(ROOT, config.baseline)
  const current = measure(config)

  if (process.argv.includes('--report')) {
    printSummary(current)
    return 0
  }

  if (process.argv.includes('--update')) {
    writeFileSync(budgetPath, render(config, current))
    console.log(`Recorded ${config.baseline}:`)
    printSummary(current)
    return 0
  }

  let recorded: Counts
  try {
    recorded = parse(readFileSync(budgetPath, 'utf8'))
  } catch {
    console.error(`No budget recorded yet. Create one with:\n  bun scripts/budget.ts --update`)
    return 1
  }

  const over: string[] = []
  for (const [key, count] of current) {
    const allowed = recorded.get(key) ?? 0
    if (count > allowed) {
      const [path, token] = key.split('\t')
      over.push(`  ${path}  ${token}  ${allowed} -> ${count}`)
    }
  }

  if (over.length > 0) {
    console.error('The migration budget grew. These are over the recorded count:\n')
    console.error(over.join('\n'))
    console.error('\nRemove them, or record a deliberate change with:\n  bun scripts/budget.ts --update')
    return 1
  }

  const currentTotal = summarise(current).total
  const recordedTotal = summarise(recorded).total
  if (currentTotal < recordedTotal) {
    console.log(`Budget is under by ${recordedTotal - currentTotal}. Record it with:`)
    console.log('  bun scripts/budget.ts --update')
    return 0
  }

  console.log(`Budget holds at ${currentTotal}.`)
  return 0
}

process.exit(main())
