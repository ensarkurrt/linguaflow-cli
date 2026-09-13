import type { LocalizationFormat } from '@linguaflow/core'

export type CliConfig = {
  branchKey: string
  projectId?: string
  branchId?: string
  overlay?: string
  format: LocalizationFormat
  sourcePath: string
  bundledPath: string
  output: string
  outputs: Partial<Record<GeneratorTarget, string>>
}

export type GeneratorTarget = 'dart' | 'typescript' | 'swift' | 'kotlin'

export type PublishedSchema = {
  keys: string[]
  messages: Record<string, { arguments: Record<string, string>; tags: string[] }>
  locales: string[]
  supportedLocales?: string[]
  sourceLocale: string
  fallbackLocale: string
  localeMappings: Record<string, string>
  releaseId: string
  sequence: number
  overlays?: Array<{ name: string; slug: string; parentSlug: string | null }>
}

export type CommandContext = {
  cwd: string
  configPath: string
  config: CliConfig
  api: import('#api-client').ApiClient
  stdout: Pick<NodeJS.WriteStream, 'write'>
}

export type LoadedCliConfig = {
  path: string
  config: CliConfig
}
