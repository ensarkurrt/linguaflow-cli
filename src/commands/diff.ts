import { diffSnapshots, type FlatTranslations } from '@linguaflow/core'
import { readLocalSnapshot } from '#local-source'
import { requireProject, url } from '#project'
import { fetchSchema } from '#schema'
import type { CommandContext } from '#types'

export async function diff(context: CommandContext): Promise<void> {
  const { projectId, branchId } = requireProject(context.config)
  const schema = await fetchSchema(context)
  const [local, remote] = await Promise.all([
    readLocalSnapshot({ cwd: context.cwd, config: context.config, schema }),
    readRemoteSnapshot(context, projectId, branchId, schema.locales),
  ])
  const changes = diffSnapshots(remote, local)
  for (const change of changes) {
    const marker = change.kind === 'added' ? '+' : change.kind === 'deleted' ? '-' : '~'
    context.stdout.write(`${marker} ${change.key}[${change.locale}] ${change.kind}\n`)
  }
  context.stdout.write(`${changes.length} local change${changes.length === 1 ? '' : 's'}.\n`)
}

async function readRemoteSnapshot(
  context: CommandContext,
  projectId: string,
  branchId: string,
  locales: string[],
): Promise<FlatTranslations> {
  const snapshot: FlatTranslations = {}
  await Promise.all(
    locales.map(async (locale) => {
      const body = await context.api.managementText(
        url(`/v1/management/projects/${projectId}/branches/${branchId}/translations/export`, {
          format: 'flat_json',
          locale,
        }),
      )
      const values = parseFlatTranslationDocument(body)
      for (const [key, value] of Object.entries(values)) {
        snapshot[key] ??= {}
        snapshot[key]![locale] = value
      }
    }),
  )
  return snapshot
}

function parseFlatTranslationDocument(body: string): Record<string, string> {
  let value: unknown
  try {
    value = JSON.parse(body) as unknown
  } catch {
    throw new Error('LinguaFlow returned invalid translation JSON')
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('LinguaFlow returned an invalid translation document')
  }
  const result: Record<string, string> = {}
  for (const [key, translation] of Object.entries(value)) {
    if (typeof translation !== 'string') {
      throw new Error('LinguaFlow returned an invalid translation value')
    }
    result[key] = translation
  }
  return result
}
