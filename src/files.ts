import { lstat, mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { CliError } from '#errors'

export async function writeAtomic(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const temporary = `${path}.${process.pid}.tmp`
  await writeFile(temporary, content, { encoding: 'utf8', mode: 0o644 })
  await rename(temporary, path)
}

export async function readUtf8(path: string): Promise<string> {
  const maximumBytes = 10 * 1024 * 1024
  try {
    const metadata = await lstat(path)
    if (!metadata.isFile()) throw new Error('not a regular file')
    if (metadata.size > maximumBytes) {
      throw new CliError(`File exceeds ${maximumBytes} bytes: ${path}`, 65)
    }
    return await readFile(path, 'utf8')
  } catch (error) {
    if (error instanceof CliError) throw error
    throw new CliError(`File not found or unreadable: ${path}`, 66)
  }
}

export function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}
