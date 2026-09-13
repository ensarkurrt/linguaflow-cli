import {
  parseLocalizationDocument,
  type FlatTranslations,
  type LocalizationFormat,
} from '@linguaflow/core'

export function documentSnapshot(input: {
  content: string
  format: LocalizationFormat
  locale?: string
  allowedLocales: string[]
  sourceLocale?: string
}): FlatTranslations {
  const translations = parseLocalizationDocument(input)
  const snapshot: FlatTranslations = {}
  for (const translation of translations) {
    snapshot[translation.key] ??= {}
    snapshot[translation.key]![translation.locale] = translation.value
  }
  return snapshot
}

export function flattenBundle(value: unknown, prefix = ''): Record<string, string> {
  if (!isRecord(value)) throw new Error('Bundle data must be an object')
  const result: Record<string, string> = {}
  for (const [segment, child] of Object.entries(value)) {
    const key = prefix ? `${prefix}.${segment}` : segment
    if (typeof child === 'string') result[key] = child
    else Object.assign(result, flattenBundle(child, key))
  }
  return result
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
