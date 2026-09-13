import { readFile } from 'node:fs/promises'
import { isAbsolute, resolve } from 'node:path'
import { LOCALIZATION_FORMATS, type LocalizationFormat } from '@linguaflow/core'
import { CliError } from '#errors'
import type { CliConfig, LoadedCliConfig } from '#types'

export async function loadConfig(cwd: string, requestedPath?: string): Promise<LoadedCliConfig> {
  const path = resolve(cwd, requestedPath ?? '.linguaconfig')
  let value: unknown
  try {
    value = JSON.parse(await readFile(path, 'utf8'))
  } catch (error) {
    if (error instanceof SyntaxError) throw new CliError(`${path} is not valid JSON`, 65)
    throw new CliError(`LinguaFlow config not found: ${path}`, 66)
  }
  if (!isRecord(value)) throw new CliError('LinguaFlow config must be a JSON object', 65)
  const branchKey = requiredString(value, 'branchKey')
  if (!/^br_live_[A-Za-z0-9_-]+$/.test(branchKey)) {
    throw new CliError('branchKey must be a LinguaFlow public delivery key', 65)
  }
  const format = (value.format ?? 'nested_json') as LocalizationFormat
  if (!LOCALIZATION_FORMATS.includes(format))
    throw new CliError(`Unsupported format: ${format}`, 65)
  return {
    path,
    config: {
      branchKey,
      projectId: optionalUuid(value, 'projectId'),
      branchId: optionalUuid(value, 'branchId'),
      overlay: optionalSlug(value, 'overlay'),
      format,
      sourcePath: pathValue(value, 'sourcePath', 'translations'),
      bundledPath: pathValue(value, 'bundledPath', 'assets/linguaflow'),
      output: pathValue(value, 'output', 'lib/generated/linguaflow_keys.dart'),
      outputs: generatorOutputs(value),
    },
  }
}

function generatorOutputs(value: Record<string, unknown>): CliConfig['outputs'] {
  const outputs = value.outputs
  if (outputs === undefined) return {}
  if (!isRecord(outputs)) throw new CliError('outputs must be an object', 65)
  const allowed = new Set(['dart', 'typescript', 'swift', 'kotlin'])
  for (const key of Object.keys(outputs)) {
    if (!allowed.has(key)) throw new CliError(`Unsupported generator target: ${key}`, 65)
  }
  return Object.fromEntries(
    Object.entries(outputs).map(([target, output]) => {
      if (typeof output !== 'string' || !output.trim() || output.includes('\0')) {
        throw new CliError(`outputs.${target} must be a non-empty path`, 65)
      }
      return [target, output]
    }),
  ) as CliConfig['outputs']
}

function optionalSlug(value: Record<string, unknown>, key: string): string | undefined {
  const result = value[key]
  if (result === undefined) return undefined
  if (typeof result !== 'string' || !/^[a-z0-9][a-z0-9-]{1,47}$/.test(result)) {
    throw new CliError(`${key} must be a valid overlay slug`, 65)
  }
  return result
}

export function fromProject(cwd: string, value: string): string {
  return isAbsolute(value) ? value : resolve(cwd, value)
}

function pathValue(value: Record<string, unknown>, key: string, fallback: string): string {
  const result = value[key] ?? fallback
  if (typeof result !== 'string' || !result.trim() || result.includes('\0')) {
    throw new CliError(`${key} must be a non-empty path`, 65)
  }
  return result
}

function optionalUuid(value: Record<string, unknown>, key: string): string | undefined {
  const result = value[key]
  if (result === undefined) return undefined
  if (typeof result !== 'string' || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(result)) {
    throw new CliError(`${key} must be a UUID`, 65)
  }
  return result
}

function requiredString(value: Record<string, unknown>, key: string): string {
  const result = value[key]
  if (typeof result !== 'string' || !result.trim()) throw new CliError(`${key} is required`, 65)
  return result
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
