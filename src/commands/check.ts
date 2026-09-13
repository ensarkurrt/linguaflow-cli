import { validateTranslations } from '@linguaflow/core'
import { CliError } from '#errors'
import { readLocalSnapshot } from '#local-source'
import { fetchSchema } from '#schema'
import type { CommandContext } from '#types'

export async function check(context: CommandContext): Promise<void> {
  const schema = await fetchSchema(context)
  const snapshot = await readLocalSnapshot({ cwd: context.cwd, config: context.config, schema })
  const keys = new Set([...schema.keys, ...Object.keys(snapshot)])
  const issues = validateTranslations({
    sourceLocale: schema.sourceLocale,
    fallbackLocale: schema.fallbackLocale,
    locales: schema.locales,
    entries: [...keys].sort().map((key) => ({ key, values: snapshot[key] ?? {} })),
  })
  for (const issue of issues) {
    context.stdout.write(
      `${issue.severity === 'blocker' ? 'ERROR' : 'WARN '} ${issue.key}[${issue.locale}] ${issue.code}: ${issue.message}\n`,
    )
  }
  const blockers = issues.filter(({ severity }) => severity === 'blocker').length
  const warnings = issues.length - blockers
  context.stdout.write(`Checked ${keys.size} keys: ${blockers} blockers, ${warnings} warnings.\n`)
  if (blockers) throw new CliError('Localization check failed', 2)
}
