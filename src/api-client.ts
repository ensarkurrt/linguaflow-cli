import { CliError } from '#errors'
import { cliVersion } from '#version'
import {
  ManagementApiError,
  ManagementContractError,
  ManagementNetworkError,
  ManagementTransport,
  type ResponseDecoder,
} from '@linguaflow/management-sdk'

const productionOrigin = 'https://api.linguaflow.dev'
const runtimeContractVersion = '2'
const maxPublicResponseBytes = 10 * 1024 * 1024

export type JsonDecoder<T> = ResponseDecoder<T>

export class ApiClient {
  private managementTransport?: ManagementTransport

  constructor(
    private readonly managementKey = process.env.LINGUAFLOW_MANAGEMENT_KEY,
    private readonly transport: typeof fetch = fetch,
  ) {}

  publicJson<T>(path: string, decoder: JsonDecoder<T>, init: RequestInit = {}): Promise<T> {
    return this.requestJson(path, decoder, init)
  }

  managementJson<T>(path: string, decoder: JsonDecoder<T>, init: RequestInit = {}): Promise<T> {
    try {
      return this.management.json(path, decoder, init).catch((error: unknown) => {
        throw managementCliError(error)
      })
    } catch (error) {
      throw managementCliError(error)
    }
  }

  async managementVoid(path: string, init: RequestInit = {}): Promise<void> {
    try {
      await this.management.empty(path, init)
    } catch (error) {
      throw managementCliError(error)
    }
  }

  async managementText(path: string): Promise<string> {
    try {
      return await this.management.text(path)
    } catch (error) {
      throw managementCliError(error)
    }
  }

  private get management(): ManagementTransport {
    if (!this.managementKey?.startsWith('lf_mgmt_live_')) {
      throw new CliError('Set LINGUAFLOW_MANAGEMENT_KEY to use management commands', 77)
    }
    return (this.managementTransport ??= new ManagementTransport(
      this.managementKey,
      this.transport,
    ))
  }

  private async requestJson<T>(
    path: string,
    decoder: JsonDecoder<T>,
    init: RequestInit,
  ): Promise<T> {
    const response = await this.request(path, init)
    let payload: unknown
    try {
      payload = JSON.parse(await readResponseText(response, maxPublicResponseBytes)) as unknown
      return decoder.parse(payload)
    } catch (error) {
      if (error instanceof CliError) throw error
      throw new CliError(`LinguaFlow returned an incompatible response for ${path}`, 65)
    }
  }

  private async request(path: string, init: RequestInit): Promise<Response> {
    const headers = new Headers(init.headers)
    if (
      path.startsWith('/v1/bundles/') ||
      path.startsWith('/v1/schema/') ||
      path.startsWith('/v1/telemetry/')
    ) {
      headers.set('x-linguaflow-sdk', 'cli')
      headers.set('x-linguaflow-sdk-version', cliVersion)
      headers.set('x-linguaflow-contract-version', runtimeContractVersion)
    }
    if (init.body) headers.set('content-type', 'application/json')
    const response = await this.transport(new URL(path, productionOrigin), {
      ...init,
      redirect: 'error',
      signal: init.signal ?? AbortSignal.timeout(30_000),
      headers,
    }).catch((error: unknown) => {
      throw new CliError(
        error instanceof Error && error.name === 'TimeoutError'
          ? 'LinguaFlow request timed out'
          : 'LinguaFlow API is unreachable',
        69,
      )
    })
    if (!response.ok) {
      const payload: unknown = await readResponseText(response, 256 * 1024)
        .then((body) => JSON.parse(body) as unknown)
        .catch(() => null)
      throw new CliError(
        apiErrorMessage(payload) ?? `LinguaFlow request failed (${response.status})`,
      )
    }
    return response
  }
}

async function readResponseText(response: Response, maxBytes: number): Promise<string> {
  const declaredLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new CliError('LinguaFlow response is too large', 65)
  }
  if (!response.body) return ''
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let body = ''
  let receivedBytes = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    receivedBytes += value.byteLength
    if (receivedBytes > maxBytes) {
      await reader.cancel()
      throw new CliError('LinguaFlow response is too large', 65)
    }
    body += decoder.decode(value, { stream: true })
  }
  return body + decoder.decode()
}

function managementCliError(error: unknown): CliError {
  if (error instanceof CliError) return error
  if (error instanceof ManagementContractError) {
    return new CliError(`LinguaFlow returned an incompatible response for ${error.path}`, 65)
  }
  if (error instanceof ManagementNetworkError) {
    return new CliError(
      error.timedOut ? 'LinguaFlow request timed out' : 'LinguaFlow API is unreachable',
      69,
    )
  }
  if (error instanceof ManagementApiError) {
    return new CliError(error.apiMessage ?? `LinguaFlow request failed (${error.status})`)
  }
  return new CliError('Unexpected LinguaFlow Management API failure')
}

function apiErrorMessage(value: unknown): string | null {
  if (!isRecord(value) || !isRecord(value.error)) return null
  return typeof value.error.message === 'string' ? value.error.message : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
