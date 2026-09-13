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
  const strategy = (args.option('--strategy') ?? 'reject') as MissingTranslationStrategy
  if (!['reject', 'use_fallback', 'omit_incomplete', 'remove_incomplete'].includes(strategy)) {
    throw new CliError(`Unknown missing translation strategy: ${strategy}`, 64)
  }
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
    context.stdout.write(`Created approval request ${result.approvalRequest.id}.\n`)
    return
  }
  const verb = result.status === 'scheduled' ? 'Scheduled' : 'Published'
  context.stdout.write(`${verb} release ${result.release.sequence} (${result.release.id}).\n`)
}
