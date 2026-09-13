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
      const values = JSON.parse(body) as Record<string, string>
      for (const [key, value] of Object.entries(values)) {
        snapshot[key] ??= {}
        snapshot[key]![locale] = value
      }
    }),
  )
  return snapshot
}
