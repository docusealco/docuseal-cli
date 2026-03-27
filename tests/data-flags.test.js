import { describe, test } from 'node:test'
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
