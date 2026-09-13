import { join } from 'node:path'
import { fromProject } from '#config'
import { json, writeAtomic } from '#files'
import type { CommandContext } from '#types'
import { validateSchema } from '#schema'
import { publishedSchemaContract, translationBundleSchema } from '#api-contracts'

export async function pull(context: CommandContext): Promise<void> {
  const key = encodeURIComponent(context.config.branchKey)
  const schema = validateSchema(
    await context.api.publicJson(`/v1/schema/${key}`, publishedSchemaContract),
  )
  const output = fromProject(context.cwd, context.config.bundledPath)
  const overlayHeaders = context.config.overlay
    ? { 'x-linguaflow-overlay': context.config.overlay }
    : undefined
  const bundles = await Promise.all(
    schema.locales.map(async (locale) => ({
      locale,
      body: await context.api.publicJson(
        `/v1/bundles/${key}/${encodeURIComponent(locale)}`,
        translationBundleSchema,
        { headers: overlayHeaders },
      ),
    })),
  )
  await Promise.all([
    writeAtomic(join(context.cwd, '.linguaflow', 'schema.json'), json(schema)),
    ...bundles.map(({ locale, body }) => writeAtomic(join(output, `${locale}.json`), json(body))),
    writeAtomic(
      join(output, 'manifest.json'),
      json({
        version: 1,
        releaseId: schema.releaseId,
        sequence: schema.sequence,
        requestedLocale: schema.fallbackLocale,
        resolvedLocale: schema.fallbackLocale,
        supportedLocales: schema.supportedLocales ?? [
          ...new Set([...schema.locales, ...Object.keys(schema.localeMappings)]),
        ],
        translatedLocales: schema.locales,
        fallbackLocale: schema.fallbackLocale,
        localeMappings: schema.localeMappings,
        reason: 'fallback',
        bundlePath: '',
        overlays: schema.overlays?.map((overlay) => overlay.slug) ?? [],
        overlay: context.config.overlay ?? null,
        missingKeyTelemetry: { enabled: false, maxBatchSize: 100 },
        rollout: {
          candidateReleaseId: schema.releaseId,
          percentage: 100,
          selection: 'stable',
        },
      }),
    ),
  ])
  context.stdout.write(
    `Pulled ${schema.locales.length} locale bundles from release ${schema.sequence}${context.config.overlay ? ` with ${context.config.overlay} overlay` : ''}.\n`,
  )
}
