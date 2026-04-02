import { describe, test, before, after } from 'node:test'
import { writeFileSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import assert from 'node:assert/strict'
import { parseDataFlags, deepMerge } from '../src/lib/data-flags.js'

describe('deepMerge', () => {
  test('merges flat objects', () => {
    assert.deepEqual(deepMerge({ a: 1 }, { b: 2 }), { a: 1, b: 2 })
  })

  test('overrides scalar', () => {
    assert.deepEqual(deepMerge({ a: 1 }, { a: 2 }), { a: 2 })
  })

  test('merges nested objects', () => {
    assert.deepEqual(
      deepMerge({ a: { b: 1 } }, { a: { c: 2 } }),
      { a: { b: 1, c: 2 } }
    )
  })

  test('merges arrays by index', () => {
    assert.deepEqual(
      deepMerge({ items: [{ a: 1 }] }, { items: [{ b: 2 }] }),
      { items: [{ a: 1, b: 2 }] }
    )
  })

  test('explicit flags + -d merge', () => {
    const body = { template_id: 1 }
    deepMerge(body, parseDataFlags(['submitters[0][email]=a@b.com']))
    assert.deepEqual(body, {
      template_id: 1,
      submitters: [{ email: 'a@b.com' }],
    })
  })
})

describe('resolveFiles', () => {
  let tmpFile

  before(() => {
    tmpFile = join(tmpdir(), 'docuseal-df-test.pdf')
    writeFileSync(tmpFile, 'dummy-pdf-content')
  })

  after(() => unlinkSync(tmpFile))

  test('resolves documents[0][file] to base64', () => {
    const result = parseDataFlags([`documents[0][file]=${tmpFile}`])
    const base64 = Buffer.from('dummy-pdf-content').toString('base64')
    assert.equal(result.documents[0].file, base64)
  })

  test('sets name from filename when not provided', () => {
    const result = parseDataFlags([`documents[0][file]=${tmpFile}`])
    assert.equal(result.documents[0].name, 'docuseal-df-test.pdf')
  })

  test('preserves explicit name', () => {
    const result = parseDataFlags([`documents[0][file]=${tmpFile}`, 'documents[0][name]=My Doc'])
    assert.equal(result.documents[0].name, 'My Doc')
  })

  test('leaves file as string when path does not exist', () => {
    const result = parseDataFlags(['documents[0][file]=/nonexistent/file.pdf'])
    assert.equal(result.documents[0].file, '/nonexistent/file.pdf')
  })

  test('resolves file in nested array items', () => {
    const result = parseDataFlags([`documents[0][file]=${tmpFile}`, `documents[1][file]=${tmpFile}`])
    const base64 = Buffer.from('dummy-pdf-content').toString('base64')
    assert.equal(result.documents[0].file, base64)
    assert.equal(result.documents[1].file, base64)
  })

  test('does not resolve URL values', () => {
    const result = parseDataFlags(['documents[0][file]=https://example.com/doc.pdf'])
    assert.equal(result.documents[0].file, 'https://example.com/doc.pdf')
  })

  test('does not resolve non-file keys', () => {
    const result = parseDataFlags([`documents[0][html]=${tmpFile}`])
    assert.equal(result.documents[0].html, tmpFile)
  })
})
