import type { CommandContext } from '#types'
import { draftRevisionContract } from '#api-contracts'

export async function fetchDraftRevision(
  context: CommandContext,
  branchId: string,
): Promise<number> {
  const draft = await context.api.managementJson(
    `/v1/management/branches/${branchId}/draft`,
    draftRevisionContract,
  )
  return draft.revision
}
