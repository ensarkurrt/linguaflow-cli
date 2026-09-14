import { join } from 'node:path'
import type { FlatTranslations, LocalizationFormat } from '@linguaflow/core'
import { fromProject } from '#config'
import { readUtf8 } from '#files'
import { documentSnapshot } from '#local-documents'
import type { CliConfig, PublishedSchema } from '#types'

export type LocalLocalizationDocument = {
  content: string
  format: LocalizationFormat
  locale?: string
}

export async function readLocalSnapshot(input: {
  cwd: string
  config: CliConfig
  schema: PublishedSchema
}): Promise<FlatTranslations> {
  const { cwd, config, schema } = input
  const source = fromProject(cwd, config.sourcePath)
  if (config.format === 'csv' || config.format === 'string_catalog') {
    return documentSnapshot({
      content: await readUtf8(source),
      format: 'csv',
      allowedLocales: schema.locales,
      sourceLocale: schema.sourceLocale,
    })
  }
  const snapshot: FlatTranslations = {}
  for (const locale of schema.locales) {
    const path = join(source, `${locale}.${extension(config.format)}`)
    const content = await readUtf8(path)
    const parsed = normalizeSourceContent(content, config.format)
    const values = documentSnapshot({
      content: parsed,
      format: config.format,
      locale,
      allowedLocales: schema.locales,
      sourceLocale: schema.sourceLocale,
    })
    for (const [key, localized] of Object.entries(values)) {
      snapshot[key] ??= {}
      Object.assign(snapshot[key]!, localized)
    }
  }
  return snapshot
}

export async function readLocalDocuments(input: {
  cwd: string
  config: CliConfig
  locales: string[]
}): Promise<LocalLocalizationDocument[]> {
  const source = fromProject(input.cwd, input.config.sourcePath)
  if (input.config.format === 'csv' || input.config.format === 'string_catalog') {
    return [{ content: await readUtf8(source), format: input.config.format }]
  }
  const format = input.config.format
  return Promise.all(
    input.locales.map(async (locale) => ({
      content: normalizeSourceContent(
        await readUtf8(join(source, `${locale}.${extension(format)}`)),
        format,
      ),
      format,
      locale,
    })),
  )
}

function extension(format: Exclude<LocalizationFormat, 'csv'>): string {
  if (format === 'arb') return 'arb'
  if (format === 'po') return 'po'
  if (format === 'xliff') return 'xlf'
  if (format === 'yaml') return 'yaml'
  if (format === 'android_xml') return 'xml'
  if (format === 'apple_strings') return 'strings'
  if (format === 'string_catalog') return 'xcstrings'
  return 'json'
}

function isJsonFormat(format: LocalizationFormat): boolean {
  return format === 'nested_json' || format === 'flat_json' || format === 'arb'
}

export function normalizeSourceContent(content: string, format: LocalizationFormat): string {
  return isJsonFormat(format) ? parseSourceEnvelope(content) : content
}

export function parseSourceEnvelope(content: string): string {
  const value = JSON.parse(content) as unknown
  if (isRecord(value) && isRecord(value.data) && isRecord(value.meta)) {
    return JSON.stringify(value.data)
  }
  return content
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
