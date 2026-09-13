import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { CliError } from '#errors'

export async function writeAtomic(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const temporary = `${path}.${process.pid}.tmp`
  await writeFile(temporary, content, { encoding: 'utf8', mode: 0o644 })
  await rename(temporary, path)
}

export async function readUtf8(path: string): Promise<string> {
  return readFile(path, 'utf8').catch(() => {
    throw new CliError(`File not found or unreadable: ${path}`, 66)
  })
}

export function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}
