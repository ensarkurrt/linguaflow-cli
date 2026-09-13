import { CliError } from '#errors'

export class Arguments {
  readonly command: string
  private readonly values: string[]

  constructor(argv: string[]) {
    const normalized = argv[0] === '--' ? argv.slice(1) : argv
    this.command = normalized[0] ?? 'help'
    this.values = normalized.slice(1)
  }

  option(name: string): string | undefined {
    const equals = this.values.find((value) => value.startsWith(`${name}=`))
    if (equals) return equals.slice(name.length + 1)
    const index = this.values.indexOf(name)
    if (index === -1) return undefined
    const value = this.values[index + 1]
    if (!value || value.startsWith('--')) throw new CliError(`${name} requires a value`, 64)
    return value
  }

  requireOption(name: string): string {
    const value = this.option(name)
    if (!value) throw new CliError(`Missing required option ${name}`, 64)
    return value
  }

  flag(name: string): boolean {
    return this.values.includes(name)
  }

  positionals(): string[] {
    const result: string[] = []
    for (let index = 0; index < this.values.length; index += 1) {
      const value = this.values[index]!
      if (value.startsWith('--')) {
        if (
          !value.includes('=') &&
          this.values[index + 1] &&
          !this.values[index + 1]!.startsWith('--')
        )
          index += 1
      } else result.push(value)
    }
    return result
  }
}
