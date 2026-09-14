import { z } from 'zod'
import {
  BranchCreatedResponseDto,
  BranchListResponseDto,
  DraftResponseDto,
  LocalizationImportResponseDto,
  PublishReleaseResponseDto,
} from '@linguaflow/management-sdk/schemas'

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

export const branchListContract = BranchListResponseDto
export const createdBranchContract = BranchCreatedResponseDto
export const draftRevisionContract = DraftResponseDto.pick({ revision: true })
export const importResultContract = LocalizationImportResponseDto
export type ImportResult = ReturnType<typeof importResultContract.parse>
export const publishResultContract = PublishReleaseResponseDto.superRefine((result, context) => {
  if (result.status === 'approval_required' && !result.requestId) {
    context.addIssue({ code: 'custom', message: 'Approval response requires requestId' })
  }
  if (result.status !== 'approval_required' && !result.release) {
    context.addIssue({ code: 'custom', message: 'Published response requires release' })
  }
})
