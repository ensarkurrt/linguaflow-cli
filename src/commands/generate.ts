import { join } from 'node:path'
import { fromProject } from '#config'
import { generateDart, generateKotlin, generateSwift, generateTypeScript } from '#generator'
import { readUtf8, writeAtomic } from '#files'
import type { CommandContext, GeneratorTarget, PublishedSchema } from '#types'
import { validateSchema } from '#schema'
import { publishedSchemaContract } from '#api-contracts'

export async function generate(context: CommandContext): Promise<void> {
  const schemaPath = join(context.cwd, '.linguaflow', 'schema.json')
  let schema: PublishedSchema
  try {
    schema = validateSchema(JSON.parse(await readUtf8(schemaPath)) as unknown)
  } catch {
    schema = validateSchema(
      await context.api.publicJson(
        `/v1/schema/${encodeURIComponent(context.config.branchKey)}`,
        publishedSchemaContract,
      ),
    )
  }
  const outputs = Object.keys(context.config.outputs).length
    ? context.config.outputs
    : { dart: context.config.output }
  for (const [target, configuredPath] of Object.entries(outputs) as Array<
    [GeneratorTarget, string]
  >) {
    const output = fromProject(context.cwd, configuredPath)
    await writeAtomic(output, generators[target](schema))
    context.stdout.write(`Generated ${schema.keys.length} typed ${target} keys at ${output}.\n`)
  }
}

const generators: Record<GeneratorTarget, (schema: PublishedSchema) => string> = {
  dart: generateDart,
  typescript: generateTypeScript,
  swift: generateSwift,
  kotlin: generateKotlin,
}
