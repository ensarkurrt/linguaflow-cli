import type { CommandContext, PublishedSchema } from '#types'
import { CliError } from '#errors'
import { publishedSchemaContract } from '#api-contracts'

export function fetchSchema(context: CommandContext): Promise<PublishedSchema> {
  return context.api
    .publicJson(
      `/v1/schema/${encodeURIComponent(context.config.branchKey)}`,
      publishedSchemaContract,
    )
    .then(validateSchema)
}

export function validateSchema(input: unknown): PublishedSchema {
  let schema: PublishedSchema
  try {
    schema = publishedSchemaContract.parse(input)
  } catch {
    throw new CliError('Invalid LinguaFlow schema response', 65)
  }
  if (
    !schema ||
    !Array.isArray(schema.keys) ||
    !Array.isArray(schema.locales) ||
    typeof schema.messages !== 'object' ||
    typeof schema.releaseId !== 'string' ||
    !Number.isInteger(schema.sequence)
  ) {
    throw new CliError('Invalid LinguaFlow schema response', 65)
  }
  if (schema.locales.some((locale) => !/^[A-Za-z]{2,3}(?:[-_][A-Za-z0-9]{2,8})*$/.test(locale))) {
    throw new CliError('LinguaFlow schema contains an invalid locale', 65)
  }
  return schema
}
