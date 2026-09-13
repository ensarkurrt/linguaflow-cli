#!/usr/bin/env node
import { run } from '#cli'
import { CliError } from '#errors'

run(process.argv.slice(2)).catch((error: unknown) => {
  const cliError = error instanceof CliError ? error : new CliError('Unexpected CLI failure')
  process.stderr.write(`${cliError.message}\n`)
  process.exitCode = cliError.exitCode
  if (!(error instanceof CliError) && process.env.LINGUAFLOW_DEBUG) console.error(error)
})

export { run } from '#cli'
export { ApiClient } from '#api-client'
