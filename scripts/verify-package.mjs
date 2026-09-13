import { spawnSync } from 'node:child_process'
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'

const packageDirectory = resolve(import.meta.dirname, '..')
const artifactsDirectory = join(packageDirectory, '.artifacts')
const archives = (await readdir(artifactsDirectory)).filter((file) => file.endsWith('.tgz')).sort()
const archive = archives.at(-1)
if (!archive) throw new Error('Doğrulanacak npm paketi bulunamadı')

const temporaryDirectory = await mkdtemp(join(tmpdir(), 'linguaflow-cli-package-'))
try {
  run('tar', ['-xzf', join(artifactsDirectory, archive), '-C', temporaryDirectory])
  const manifest = JSON.parse(
    await readFile(join(temporaryDirectory, 'package', 'package.json'), 'utf8'),
  )
  if (Object.keys(manifest.dependencies ?? {}).length) {
    throw new Error('CLI paketi runtime bağımlılığı taşımamalıdır')
  }
  const executable = join(temporaryDirectory, 'package', manifest.bin.linguaflow)
  const result = run(process.execPath, [executable, 'help'], true)
  if (!result.stdout.includes('LinguaFlow CLI')) {
    throw new Error(`${basename(archive)} bağımsız CLI doğrulaması başarısız`)
  }
  process.stdout.write(`${archive} bağımsız executable olarak doğrulandı\n`)
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true })
}

function run(command, args, capture = false) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: capture ? 'pipe' : 'inherit',
  })
  if (result.status !== 0) throw new Error(result.stderr || `${command} başarısız`)
  return result
}
