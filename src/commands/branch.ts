import { Arguments } from '#arguments'
import { CliError } from '#errors'
import { fetchDraftRevision } from '#draft'
import { requireProject } from '#project'
import type { CommandContext } from '#types'
import { branchListContract, createdBranchContract, draftRevisionContract } from '#api-contracts'

export async function branch(context: CommandContext, args: Arguments): Promise<void> {
  const { projectId, branchId } = requireProject(context.config)
  const operation = args.positionals()[0] ?? 'list'
  if (operation === 'list') {
    const result = await context.api.managementJson(
      `/v1/management/projects/${projectId}/branches`,
      branchListContract,
    )
    for (const item of result.branches) {
      const active = item.id === branchId ? '*' : ' '
      context.stdout.write(`${active} ${item.name.padEnd(20)} ${item.id}\n`)
    }
    return
  }
  if (operation === 'create') {
    const name = args.requireOption('--name')
    const sourceBranchId = args.option('--from') ?? branchId
    const result = await context.api.managementJson(
      `/v1/management/projects/${projectId}/branches`,
      createdBranchContract,
      { method: 'POST', body: JSON.stringify({ name, sourceBranchId }) },
    )
    context.stdout.write(`Created branch ${name} (${result.id}) from ${sourceBranchId}.\n`)
    return
  }
  if (operation === 'overwrite') {
    const targetBranchId = args.option('--target') ?? branchId
    const sourceBranchId = args.requireOption('--from')
    const expectedRevision = await fetchDraftRevision(context, targetBranchId)
    await context.api.managementJson(
      `/v1/management/branches/${targetBranchId}/overwrite`,
      draftRevisionContract,
      { method: 'POST', body: JSON.stringify({ sourceBranchId, expectedRevision }) },
    )
    context.stdout.write(`Overwrote ${targetBranchId} from ${sourceBranchId}.\n`)
    return
  }
  throw new CliError(`Unknown branch operation: ${operation}`, 64)
}
