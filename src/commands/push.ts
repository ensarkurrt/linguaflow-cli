import { readFile } from 'node:fs/promises'
import { LOCALIZATION_FORMATS, type LocalizationFormat } from '@linguaflow/core'
import { Arguments } from '#arguments'
import { fromProject } from '#config'
import { CliError } from '#errors'
import { normalizeSourceContent, readLocalDocuments } from '#local-source'
import { requireProject, url } from '#project'
import { fetchSchema } from '#schema'
import { fetchDraftRevision } from '#draft'
import type { CommandContext } from '#types'
import { importResultContract } from '#api-contracts'

export async function push(context: CommandContext, args: Arguments): Promise<void> {
  const { projectId, branchId } = requireProject(context.config)
  const format = (args.option('--format') ?? context.config.format) as LocalizationFormat
  if (!LOCALIZATION_FORMATS.includes(format))
    throw new CliError(`Unsupported format: ${format}`, 64)
  const locale = args.option('--locale')
  const requestedFile = args.option('--file')
  if (requestedFile && !['csv', 'string_catalog'].includes(format) && !locale) {
    throw new CliError('--locale is required when pushing one per-language file', 64)
  }
  const documents = requestedFile
    ? [
        {
          format,
          locale,
          content: await readFile(fromProject(context.cwd, requestedFile), 'utf8')
            .catch(() => {
              throw new CliError(`Translation file not found: ${requestedFile}`, 66)
            })
            .then((content) => normalizeSourceContent(content, format)),
        },
      ]
    : await readLocalDocuments({
        cwd: context.cwd,
        config: context.config,
        locales: (await fetchSchema(context)).locales,
      })
  const results: Array<{ keyCount: number; valueCount: number; locales: string[] }> = []
  let expectedRevision = await fetchDraftRevision(context, branchId)
  for (const document of documents) {
    const result = await context.api.managementJson(
      url(`/v1/management/projects/${projectId}/branches/${branchId}/translations/import`),
      importResultContract,
      { method: 'POST', body: JSON.stringify({ ...document, expectedRevision }) },
    )
    results.push(result)
    expectedRevision = result.revision
  }
  const result = {
    keyCount: Math.max(...results.map(({ keyCount }) => keyCount)),
    valueCount: results.reduce((sum, item) => sum + item.valueCount, 0),
    locales: [...new Set(results.flatMap((item) => item.locales))],
  }
  context.stdout.write(
    `Pushed ${result.valueCount} values across ${result.keyCount} keys (${result.locales.join(', ')}).\n`,
  )
}
