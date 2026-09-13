import { z } from 'zod'

const translationValueSchema: z.ZodType<Record<string, unknown>> = z.lazy(() =>
  z.record(z.string(), z.union([z.string(), translationValueSchema])),
)

export const translationBundleSchema = translationValueSchema

export const publishedSchemaContract = z
  .object({
    keys: z.array(z.string()),
    messages: z.record(
      z.string(),
      z.object({
        arguments: z.record(z.string(), z.string()),
        tags: z.array(z.string()),
      }),
    ),
    locales: z.array(z.string()),
    supportedLocales: z.array(z.string()).optional(),
    sourceLocale: z.string(),
    fallbackLocale: z.string(),
    localeMappings: z.record(z.string(), z.string()),
    releaseId: z.string(),
    sequence: z.number().int(),
    overlays: z
      .array(z.object({ name: z.string(), slug: z.string(), parentSlug: z.string().nullable() }))
      .optional(),
  })
  .strip()

export const branchListContract = z.object({
  branches: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      publishedReleaseId: z.string().nullable(),
    }),
  ),
})

export const createdBranchContract = z.object({ id: z.string() })
export const draftRevisionContract = z.object({ revision: z.number().int().nonnegative() })

export const importResultContract = z.object({
  revision: z.number().int().nonnegative(),
  keyCount: z.number().int().nonnegative(),
  valueCount: z.number().int().nonnegative(),
  locales: z.array(z.string()),
})

const releaseSchema = z.object({ id: z.string(), sequence: z.number().int() })
export const publishResultContract = z.discriminatedUnion('status', [
  z.object({ status: z.enum(['published', 'scheduled']), release: releaseSchema }),
  z.object({
    status: z.literal('approval_required'),
    approvalRequest: z.object({ id: z.string() }),
  }),
])
