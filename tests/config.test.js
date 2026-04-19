import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveServer } from '../src/lib/config.js'

describe('resolveServer', () => {
  test('resolves "global" alias', () => {
    assert.equal(resolveServer('global'), 'https://api.docuseal.com')
  })

  test('resolves "europe" alias', () => {
    assert.equal(resolveServer('europe'), 'https://api.docuseal.eu')
  })

  test('is idempotent for global URL', () => {
    assert.equal(resolveServer('https://api.docuseal.com'), 'https://api.docuseal.com')
  })

  test('is idempotent for europe URL', () => {
    assert.equal(resolveServer('https://api.docuseal.eu'), 'https://api.docuseal.eu')
  })

  test('strips trailing slash from known URLs', () => {
    assert.equal(resolveServer('https://api.docuseal.eu/'), 'https://api.docuseal.eu')
  })

  test('appends /api to self-hosted URL', () => {
    assert.equal(resolveServer('https://docuseal.company.com'), 'https://docuseal.company.com/api')
  })

  test('does not double-append /api to self-hosted URL', () => {
    assert.equal(resolveServer('https://docuseal.company.com/api'), 'https://docuseal.company.com/api')
  })

  test('strips trailing slash from self-hosted URL', () => {
    assert.equal(resolveServer('https://docuseal.company.com/'), 'https://docuseal.company.com/api')
  })
})
