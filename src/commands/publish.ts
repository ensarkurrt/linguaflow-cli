import { randomUUID } from 'node:crypto'
import type { MissingTranslationStrategy } from '@linguaflow/core'
import { Arguments } from '#arguments'
import { CliError } from '#errors'
import { fetchDraftRevision } from '#draft'
import { requireProject } from '#project'
import type { CommandContext } from '#types'
import { publishResultContract } from '#api-contracts'

export async function publish(context: CommandContext, args: Arguments): Promise<void> {
  const { branchId } = requireProject(context.config)
  const strategyValue = args.option('--strategy') ?? 'reject'
  if (!isMissingTranslationStrategy(strategyValue)) {
    throw new CliError(`Unknown missing translation strategy: ${strategyValue}`, 64)
  }
  const strategy = strategyValue
  const expectedDraftRevision = await fetchDraftRevision(context, branchId)
  const result = await context.api.managementJson(
    `/v1/management/branches/${branchId}/releases`,
    publishResultContract,
    {
      method: 'POST',
      headers: { 'idempotency-key': args.option('--idempotency-key') ?? randomUUID() },
      body: JSON.stringify({
        message: args.requireOption('--message'),
        missingTranslationStrategy: strategy,
        expectedDraftRevision,
      }),
    },
  )
  if (result.status === 'approval_required') {
    if (!result.requestId) throw new CliError('Approval response did not include requestId', 70)
    context.stdout.write(`Created approval request ${result.requestId}.\n`)
    return
  }
  if (!result.release) throw new CliError('Publish response did not include a release', 70)
  const verb = result.status === 'scheduled' ? 'Scheduled' : 'Published'
  context.stdout.write(`${verb} release ${result.release.sequence} (${result.release.id}).\n`)
}

function isMissingTranslationStrategy(value: string): value is MissingTranslationStrategy {
  return (
    value === 'reject' ||
    value === 'use_fallback' ||
    value === 'omit_incomplete' ||
    value === 'remove_incomplete'
  )
}
