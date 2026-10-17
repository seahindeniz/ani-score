import process from 'node:process'
import glob from 'fast-glob'
import fs from 'fs-extra'
import { log, r } from './utils'

/**
 * `bun test --coverage` only reports files that some test imported, so an untested file would silently count as
 * covered. This fails unless every source file with runtime code is in the report at 100% lines and functions.
 */

interface FileCoverage {
  /**
   * Hit count per executable line.
   */
  lines: Map<number, number>
  functionsFound: number
  functionsHit: number
}

function parseLcov(lcov: string) {
  const files = new Map<string, FileCoverage>()

  for (const record of lcov.split('end_of_record')) {
    const value = (key: string) => record.match(new RegExp(`^${key}:(.*)$`, 'm'))?.[1]?.trim()
    const file = value('SF')

    if (!file)
      continue

    // A fresh-instance import (`main.ts?case=1`) is reported as its own entry; merge it into the file's.
    // Lines merge exactly; the report only has function counts, so the best instance's count is used,
    // which can under-report but never over-report.
    const path = r(file.replace(/\?.*$/, '')).replace(/\\/g, '/')
    const coverage = files.get(path) ?? { lines: new Map(), functionsFound: 0, functionsHit: 0 }

    for (const [, line, hits] of record.matchAll(/^DA:(\d+),(\d+)/gm))
      coverage.lines.set(Number(line), Math.max(coverage.lines.get(Number(line)) ?? 0, Number(hits)))

    coverage.functionsFound = Math.max(coverage.functionsFound, Number(value('FNF') ?? 0))
    coverage.functionsHit = Math.max(coverage.functionsHit, Number(value('FNH') ?? 0))
    files.set(path, coverage)
  }

  return files
}

// Type-only modules compile to nothing, so no test can make them show up in the report
function hasRuntimeCode(file: string, source: string) {
  const transpiler = new Bun.Transpiler({ loader: file.endsWith('.tsx') ? 'tsx' : 'ts' })

  return transpiler.transformSync(source).replace(/export\s*\{\s*\};?/g, '').trim() !== ''
}

const lcovPath = r('coverage/lcov.info')

if (!await fs.pathExists(lcovPath)) {
  log('COVERAGE', `error: ${lcovPath} not found, run the tests with coverage first`)
  process.exit(1)
}

const report = parseLcov(await fs.readFile(lcovPath, 'utf-8'))
const sourceFiles = await glob('src/**/*.{ts,tsx}', {
  cwd: r(),
  absolute: true,
  ignore: ['src/gql/**', 'src/**/*.d.ts', 'src/**/__tests__/**', '**/node_modules/**'],
})
const problems: string[] = []

for (const file of sourceFiles.sort()) {
  const relative = file.slice(r().replace(/\\/g, '/').length + 1)
  const coverage = report.get(file)

  if (!coverage) {
    if (hasRuntimeCode(file, await fs.readFile(file, 'utf-8')))
      problems.push(`${relative}: not covered by any test`)

    continue
  }

  const uncoveredLines = Array.from(coverage.lines).filter(([, hits]) => hits === 0).map(([line]) => line)

  if (uncoveredLines.length)
    problems.push(`${relative}: lines ${uncoveredLines.join(', ')} not covered`)
  if (coverage.functionsHit < coverage.functionsFound)
    problems.push(`${relative}: ${coverage.functionsHit}/${coverage.functionsFound} functions`)
}

if (problems.length) {
  log('COVERAGE', `${problems.length} problem(s):\n  ${problems.join('\n  ')}`)
  process.exit(1)
}

log('COVERAGE', `all ${sourceFiles.length} source files are fully covered`)
