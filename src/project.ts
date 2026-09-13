import { CliError } from '#errors'
import type { CliConfig } from '#types'

export function requireProject(config: CliConfig): { projectId: string; branchId: string } {
  if (!config.projectId || !config.branchId) {
    throw new CliError('projectId and branchId are required for management commands', 65)
  }
  return { projectId: config.projectId, branchId: config.branchId }
}

export function url(path: string, query: Record<string, string | undefined> = {}): string {
  const parameters = new URLSearchParams()
  for (const [name, value] of Object.entries(query))
    if (value !== undefined) parameters.set(name, value)
  const suffix = parameters.size ? `?${parameters}` : ''
  return `${path}${suffix}`
}
