import { LOCALIZATION_FORMATS, type LocalizationFormat } from '@linguaflow/core'
import { Arguments } from '#arguments'
import { fromProject } from '#config'
import { CliError } from '#errors'
import { normalizeSourceContent, readLocalDocuments } from '#local-source'
import { requireProject, url } from '#project'
import { fetchSchema } from '#schema'
import { fetchDraftRevision } from '#draft'
import type { CommandContext } from '#types'
import { importResultContract, type ImportResult } from '#api-contracts'
import { readUtf8 } from '#files'

export async function push(context: CommandContext, args: Arguments): Promise<void> {
  const { projectId, branchId } = requireProject(context.config)
  const formatValue = args.option('--format') ?? context.config.format
  if (!isLocalizationFormat(formatValue)) {
    throw new CliError(`Unsupported format: ${formatValue}`, 64)
  }
  const format = formatValue
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
          content: normalizeSourceContent(
            await readUtf8(fromProject(context.cwd, requestedFile)),
            format,
          ),
        },
      ]
    : await readLocalDocuments({
        cwd: context.cwd,
        config: context.config,
        locales: (await fetchSchema(context)).locales,
      })
  const results: ImportResult[] = []
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

function isLocalizationFormat(value: string): value is LocalizationFormat {
  return LOCALIZATION_FORMATS.some((format) => format === value)
}
