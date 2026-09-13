import { Arguments } from '#arguments'
import { ApiClient } from '#api-client'
import { branch } from '#commands/branch'
import { check } from '#commands/check'
import { diff } from '#commands/diff'
import { generate } from '#commands/generate'
import { publish } from '#commands/publish'
import { pull } from '#commands/pull'
import { push } from '#commands/push'
import { loadConfig } from '#config'
import { CliError } from '#errors'
import { help } from '#help'
import type { CommandContext } from '#types'
import { cliVersion } from '#version'

export async function run(
  argv: string[],
  options: {
    cwd?: string
    api?: ApiClient
    stdout?: Pick<NodeJS.WriteStream, 'write'>
  } = {},
): Promise<void> {
  const args = new Arguments(argv)
  const stdout = options.stdout ?? process.stdout
  if (args.command === 'version' || args.command === '--version' || args.flag('--version')) {
    stdout.write(`${cliVersion}\n`)
    return
  }
  if (args.command === 'help' || args.flag('--help')) {
    stdout.write(help)
    return
  }
  const cwd = options.cwd ?? process.cwd()
  const loaded = await loadConfig(cwd, args.option('--config'))
  const context: CommandContext = {
    cwd,
    configPath: loaded.path,
    config: loaded.config,
    api: options.api ?? new ApiClient(),
    stdout,
  }
  switch (args.command) {
    case 'pull':
      return pull(context)
    case 'generate':
      return generate(context)
    case 'sync':
      await pull(context)
      return generate(context)
    case 'check':
      return check(context)
    case 'push':
      return push(context, args)
    case 'diff':
      return diff(context)
    case 'branch':
      return branch(context, args)
    case 'publish':
      return publish(context, args)
    default:
      throw new CliError(`Unknown command: ${args.command}\n\n${help}`, 64)
  }
}
