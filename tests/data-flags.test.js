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

describe('JSON -d support', () => {
  test('parses a single JSON object', () => {
    const result = parseDataFlags(['{"name":"NDA","template_id":1}'])
    assert.deepEqual(result, { name: 'NDA', template_id: 1 })
  })

  test('merges multiple JSON objects', () => {
    const result = parseDataFlags(['{"name":"NDA"}', '{"template_id":1}'])
    assert.deepEqual(result, { name: 'NDA', template_id: 1 })
  })

  test('merges JSON with bracket notation', () => {
    const result = parseDataFlags(['{"name":"NDA"}', 'submitters[0][email]=a@b.com'])
    assert.deepEqual(result, { name: 'NDA', submitters: [{ email: 'a@b.com' }] })
  })

  test('JSON with nested objects', () => {
    const result = parseDataFlags(['{"submitters":[{"email":"a@b.com","role":"Signer"}]}'])
    assert.deepEqual(result, { submitters: [{ email: 'a@b.com', role: 'Signer' }] })
  })

  test('later JSON overrides earlier values', () => {
    const result = parseDataFlags(['{"name":"Old"}', '{"name":"New"}'])
    assert.equal(result.name, 'New')
  })
})

describe('bracket notation values', () => {
  test('keeps + in phone numbers', () => {
    const result = parseDataFlags(['submitters[0][phone]=+1234567890'])
    assert.deepEqual(result, { submitters: [{ phone: '+1234567890' }] })
  })

  test('keeps base64 content intact', () => {
    const result = parseDataFlags(['documents[0][file]=+/++JVBERi0xLjQ='])
    assert.equal(result.documents[0].file, '+/++JVBERi0xLjQ=')
  })

  test('keeps & in URL query strings', () => {
    const result = parseDataFlags(['documents[0][file]=https://example.com/doc.pdf?a=1&b=2'])
    assert.equal(result.documents[0].file, 'https://example.com/doc.pdf?a=1&b=2')
  })

  test('keeps % literally', () => {
    const result = parseDataFlags(['submitters[0][values][Note]=50%25 off'])
    assert.equal(result.submitters[0].values.Note, '50%25 off')
  })

  test('keeps special characters in keys', () => {
    const result = parseDataFlags(['submitters[0][values][Q&A + Notes]=yes'])
    assert.deepEqual(result.submitters[0].values, { 'Q&A + Notes': 'yes' })
  })

  test('keeps = in values', () => {
    const result = parseDataFlags(['documents[0][html]=<p class="a">x=1</p>'])
    assert.equal(result.documents[0].html, '<p class="a">x=1</p>')
  })

  test('collects [] arrays across pairs', () => {
    const result = parseDataFlags(['template_ids[]=1001', 'template_ids[]=1002'])
    assert.deepEqual(result, { template_ids: ['1001', '1002'] })
  })

  test('keeps numeric field names in values as object keys', () => {
    const result = parseDataFlags(['submitters[0][values][1]=yes', 'submitters[0][values][2]=no'])
    assert.deepEqual(result, { submitters: [{ values: { 1: 'yes', 2: 'no' } }] })
  })

  test('keeps a single numeric key in values, metadata and variables', () => {
    const result = parseDataFlags(['values[5]=yes', 'metadata[0]=a', 'variables[2024]=b'])
    assert.deepEqual(result, { values: { 5: 'yes' }, metadata: { 0: 'a' }, variables: { 2024: 'b' } })
  })

  test('keeps arrays nested inside values', () => {
    const result = parseDataFlags(['values[Colors][]=red', 'values[Colors][]=blue'])
    assert.deepEqual(result, { values: { Colors: ['red', 'blue'] } })
  })

  test('still compacts index arrays', () => {
    const result = parseDataFlags(['submitters[1][email]=a@b.com'])
    assert.deepEqual(result, { submitters: [{ email: 'a@b.com' }] })
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

  test('throws when file path does not exist', () => {
    assert.throws(() => parseDataFlags(['documents[0][file]=/nonexistent/file.pdf']), /File not found: \/nonexistent\/file\.pdf/)
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
