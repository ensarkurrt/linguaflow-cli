import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { run } from '../dist/cli.js'
import { ApiClient } from '../dist/api-client.js'
import { branchListContract } from '../dist/api-contracts.js'
import {
  generateDart,
  generateKotlin,
  generateSwift,
  generateTypeScript,
} from '../dist/generator.js'
import { normalizeSourceContent, readLocalDocuments } from '../dist/local-source.js'

const schema = {
  keys: ['home.title', 'cart.items'],
  messages: {
    'home.title': { arguments: {}, tags: [] },
    'cart.items': { arguments: { count: 'number' }, tags: [] },
  },
  locales: ['en', 'tr'],
  supportedLocales: ['en', 'tr', 'ar'],
  sourceLocale: 'en',
  fallbackLocale: 'en',
  localeMappings: { ar: 'en' },
  releaseId: 'release-1',
  sequence: 4,
}

test('generator emits nested and ICU-safe typed Dart accessors', () => {
  const output = generateDart(schema)
  assert.match(output, /static const home = _HomeKeys\(\)/)
  assert.match(output, /LfMessage items\(\{required num count\}\)/)
  assert.match(output, /LfKey\('home.title'\)/)
})

test('generator emits typed React, Swift and Kotlin accessors', () => {
  assert.match(generateTypeScript(schema), /items: \(count: number\)/)
  assert.match(generateSwift(schema), /static func items\(count: Double\)/)
  assert.match(generateKotlin(schema), /fun items\(count: Number\)/)
})

test('pnpm argument separator is accepted before help', async () => {
  const output = []
  await run(['--', 'help'], { stdout: { write: (value) => output.push(value) } })
  assert.match(output.join(''), /LinguaFlow CLI/)
})

test('version does not require a project config', async () => {
  const output = []
  await run(['--version'], { stdout: { write: (value) => output.push(value) } })
  assert.equal(output.join(''), '0.1.0\n')
})

test('pull writes immutable release inputs atomically', async () => {
  const cwd = await projectDirectory()
  const output = []
  const api = {
    publicJson: async (path) => {
      if (path.startsWith('/v1/schema/')) return schema
      const locale = path.endsWith('/tr') ? 'tr' : 'en'
      return { home: { title: locale === 'tr' ? 'Merhaba' : 'Hello' } }
    },
  }
  await run(['pull'], { cwd, api, stdout: { write: (value) => output.push(value) } })
  const manifest = JSON.parse(await readFile(join(cwd, 'assets/i18n/manifest.json'), 'utf8'))
  assert.equal(manifest.releaseId, 'release-1')
  assert.deepEqual(manifest.supportedLocales, ['en', 'tr', 'ar'])
  assert.match(output.join(''), /Pulled 2 locale bundles/)
})

test('check returns exit code 2 for an invalid ICU contract', async () => {
  const cwd = await projectDirectory()
  await writeFile(
    join(cwd, 'translations/en.json'),
    JSON.stringify({
      home: { title: 'Hello {name}' },
      cart: { items: '{count, plural, one {One} other {#}}' },
    }),
  )
  await writeFile(
    join(cwd, 'translations/tr.json'),
    JSON.stringify({
      home: { title: 'Merhaba' },
      cart: { items: '{count, plural, one {Bir} other {#}}' },
    }),
  )
  const output = []
  await assert.rejects(
    run(['check'], {
      cwd,
      api: { publicJson: async () => ({ ...schema, keys: ['home.title', 'cart.items'] }) },
      stdout: { write: (value) => output.push(value) },
    }),
    (error) => error.exitCode === 2,
  )
  assert.match(output.join(''), /argument_missing/)
})

test('management client sends bearer auth and rejects redirects', async () => {
  let authorization
  const success = new ApiClient('lf_mgmt_live_secret', async (_url, init) => {
    authorization = new Headers(init.headers).get('authorization')
    assert.equal(init.redirect, 'error')
    return Response.json({ branches: [] })
  })
  await success.managementJson('/v1/management/projects/x/branches', branchListContract)
  assert.equal(authorization, 'Bearer lf_mgmt_live_secret')

  assert.throws(
    () =>
      new ApiClient(undefined, fetch).managementJson('/v1/management/projects', branchListContract),
    /LINGUAFLOW_MANAGEMENT_KEY/,
  )
})

test('management commands target configured project and branch', async () => {
  const cwd = await projectDirectory(true)
  await writeFile(
    join(cwd, 'translations/en.json'),
    JSON.stringify({
      home: { title: 'Hello' },
      cart: { items: '{count, plural, one {One} other {#}}' },
    }),
  )
  await writeFile(
    join(cwd, 'translations/tr.json'),
    JSON.stringify({
      home: { title: 'Merhaba' },
      cart: { items: '{count, plural, one {Bir} other {#}}' },
    }),
  )
  const requests = []
  const api = {
    publicJson: async () => schema,
    managementText: async (path) => {
      requests.push(['text', path])
      return JSON.stringify({ 'home.title': path.includes('locale=tr') ? 'Selam' : 'Hi' })
    },
    managementJson: async (path, _decoder, init = {}) => {
      requests.push([init.method ?? 'GET', path, init.body])
      if (path.endsWith('/draft')) return { revision: 0 }
      if (path.endsWith('/releases')) {
        return {
          status: 'published',
          release: {
            id: 'release-2',
            sequence: 5,
          },
        }
      }
      if (path.endsWith('/branches'))
        return { branches: [{ id: branchId, name: 'production', publishedReleaseId: null }] }
      return { revision: 1, keyCount: 2, valueCount: 2, locales: ['en', 'tr'] }
    },
  }
  const output = []
  const options = { cwd, api, stdout: { write: (value) => output.push(value) } }
  await run(['push'], options)
  await run(['diff'], options)
  await run(['branch', 'list'], options)
  await run(['publish', '--message', 'Release copy'], options)
  assert.equal(requests.filter(([method]) => method === 'POST').length, 3)
  assert.ok(requests.some(([, path]) => path === `/v1/management/projects/${projectId}/branches`))
  assert.match(output.join(''), /Published release 5/)
})

test('local source reader supports per-locale PO files without JSON unwrapping', async () => {
  const cwd = await projectDirectory()
  const sourcePath = join(cwd, 'po')
  await import('node:fs/promises').then(({ mkdir }) => mkdir(sourcePath))
  const content =
    'msgid ""\nmsgstr ""\n"Language: tr\\n"\n\nmsgctxt "home.title"\nmsgid "Welcome"\nmsgstr "Hoş geldiniz"\n'
  await writeFile(join(sourcePath, 'tr.po'), content)
  const documents = await readLocalDocuments({
    cwd,
    locales: ['tr'],
    config: {
      branchKey: 'br_live_test',
      format: 'po',
      sourcePath: 'po',
      bundledPath: 'assets/i18n',
      output: 'generated.dart',
      outputs: {},
    },
  })
  assert.deepEqual(documents, [{ content, format: 'po', locale: 'tr' }])
  assert.equal(normalizeSourceContent(content, 'po'), content)
  assert.equal(
    normalizeSourceContent('{"data":{"home":{"title":"Hi"}},"meta":{}}', 'nested_json'),
    '{"home":{"title":"Hi"}}',
  )
})

test('push forwards an explicit PO file without treating it as JSON', async () => {
  const cwd = await projectDirectory(true)
  const content =
    'msgid ""\nmsgstr ""\n"Language: tr\\n"\n\nmsgctxt "home.title"\nmsgid "Welcome"\nmsgstr "Hoş geldiniz"\n'
  await writeFile(join(cwd, 'translations.po'), content)
  let body
  await run(['push', '--file', 'translations.po', '--format', 'po', '--locale', 'tr'], {
    cwd,
    api: {
      managementJson: async (path, _decoder, init) => {
        if (path.endsWith('/draft')) return { revision: 7 }
        body = JSON.parse(init.body)
        return { revision: 8, keyCount: 1, valueCount: 1, locales: ['tr'] }
      },
    },
    stdout: { write() {} },
  })
  assert.deepEqual(body, { format: 'po', locale: 'tr', content, expectedRevision: 7 })
})

const projectId = '10000000-0000-4000-8000-000000000000'
const branchId = '20000000-0000-4000-8000-000000000000'

async function projectDirectory(management = false) {
  const cwd = await mkdtemp(join(tmpdir(), 'linguaflow-cli-'))
  await writeFile(
    join(cwd, '.linguaconfig'),
    JSON.stringify({
      branchKey: 'br_live_test',
      format: 'nested_json',
      sourcePath: 'translations',
      bundledPath: 'assets/i18n',
      output: 'lib/generated/strings.dart',
      ...(management ? { projectId, branchId } : {}),
    }),
  )
  await import('node:fs/promises').then(({ mkdir }) => mkdir(join(cwd, 'translations')))
  return cwd
}
