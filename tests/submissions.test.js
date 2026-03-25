import { createServer } from 'node:http'
import { execFile } from 'node:child_process'
import { writeFileSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { parseDataFlags, deepMerge } from '../src/lib/data-flags.js'

let server, port, lastRequest

before(async () => {
  server = createServer((req, res) => {
    let body = ''
    req.on('data', (chunk) => body += chunk)
    req.on('end', () => {
      lastRequest = {
        method: req.method,
        path: req.url.split('?')[0],
        query: Object.fromEntries(new URL(req.url, 'http://localhost').searchParams),
        headers: req.headers,
        body: body ? JSON.parse(body) : undefined,
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ id: 1 }))
    })
  })
  await new Promise(resolve => server.listen(0, resolve))
  port = server.address().port
})

after(() => server.close())
beforeEach(() => { lastRequest = null })

function cli(...args) {
  return new Promise((resolve) => {
    execFile('node', [join(import.meta.dirname, '..', 'src', 'index.js'), ...args], {
      env: {
        ...process.env,
        DOCUSEAL_API_KEY: 'test-key',
        DOCUSEAL_SERVER: `http://localhost:${port}`,
      },
    }, (err, stdout, stderr) => {
      resolve({ stdout, stderr, code: err?.code ?? 0 })
    })
  })
}

// --- parseDataFlags ---

describe('parseDataFlags', () => {
  test('flat key-value', () => {
    assert.deepEqual(parseDataFlags(['name=NDA']), { name: 'NDA' })
  })

  test('single submitter', () => {
    assert.deepEqual(
      parseDataFlags(['submitters[0][email]=a@b.com']),
      { submitters: [{ email: 'a@b.com' }] }
    )
  })

  test('multiple submitters', () => {
    assert.deepEqual(
      parseDataFlags(['submitters[0][email]=a@b.com', 'submitters[1][email]=c@d.com']),
      { submitters: [{ email: 'a@b.com' }, { email: 'c@d.com' }] }
    )
  })

  test('multiple fields on same submitter', () => {
    assert.deepEqual(
      parseDataFlags(['submitters[0][email]=a@b.com', 'submitters[0][role]=Signer']),
      { submitters: [{ email: 'a@b.com', role: 'Signer' }] }
    )
  })

  test('array push with empty brackets', () => {
    assert.deepEqual(
      parseDataFlags(['tags[]=one', 'tags[]=two']),
      { tags: ['one', 'two'] }
    )
  })

  test('deeply nested', () => {
    assert.deepEqual(
      parseDataFlags(['submitters[0][fields][0][name]=field1']),
      { submitters: [{ fields: [{ name: 'field1' }] }] }
    )
  })

  test('value containing =', () => {
    assert.deepEqual(
      parseDataFlags(['url=https://example.com?a=b']),
      { url: 'https://example.com?a=b' }
    )
  })

  test('ignores entries without =', () => {
    assert.deepEqual(parseDataFlags(['invalid']), {})
  })
})

// --- deepMerge ---

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

// --- submissions list ---

describe('submissions list', () => {
  test('no flags', async () => {
    await cli('submissions', 'list')
    assert.equal(lastRequest.method, 'GET')
    assert.equal(lastRequest.path, '/submissions')
  })

  test('--template-id', async () => {
    await cli('submissions', 'list', '--template-id', '42')
    assert.equal(lastRequest.query.template_id, '42')
  })

  test('--status', async () => {
    await cli('submissions', 'list', '--status', 'pending')
    assert.equal(lastRequest.query.status, 'pending')
  })

  test('--q', async () => {
    await cli('submissions', 'list', '--q', 'john')
    assert.equal(lastRequest.query.q, 'john')
  })

  test('--slug', async () => {
    await cli('submissions', 'list', '--slug', 'abc123')
    assert.equal(lastRequest.query.slug, 'abc123')
  })

  test('--template-folder', async () => {
    await cli('submissions', 'list', '--template-folder', 'Legal')
    assert.equal(lastRequest.query.template_folder, 'Legal')
  })

  test('--archived', async () => {
    await cli('submissions', 'list', '--archived')
    assert.equal(lastRequest.query.archived, 'true')
  })

  test('--no-archived', async () => {
    await cli('submissions', 'list', '--no-archived')
    assert.equal(lastRequest.query.archived, 'false')
  })

  test('--limit and --after', async () => {
    await cli('submissions', 'list', '--limit', '25', '--after', '100')
    assert.equal(lastRequest.query.limit, '25')
    assert.equal(lastRequest.query.after, '100')
  })

  test('--before', async () => {
    await cli('submissions', 'list', '--before', '50')
    assert.equal(lastRequest.query.before, '50')
  })

  test('multiple flags combined', async () => {
    await cli('submissions', 'list', '--template-id', '1', '--status', 'completed', '--limit', '5')
    assert.equal(lastRequest.query.template_id, '1')
    assert.equal(lastRequest.query.status, 'completed')
    assert.equal(lastRequest.query.limit, '5')
  })
})

// --- submissions retrieve ---

describe('submissions retrieve', () => {
  test('passes id', async () => {
    await cli('submissions', 'retrieve', '42')
    assert.equal(lastRequest.method, 'GET')
    assert.equal(lastRequest.path, '/submissions/42')
  })
})

// --- submissions archive ---

describe('submissions archive', () => {
  test('passes id', async () => {
    await cli('submissions', 'archive', '42')
    assert.equal(lastRequest.method, 'DELETE')
    assert.equal(lastRequest.path, '/submissions/42')
  })
})

// --- submissions create ---

describe('submissions create', () => {
  test('--template-id with single submitter via -d', async () => {
    await cli('submissions', 'create', '--template-id', '1', '-d', 'submitters[0][email]=a@b.com')
    assert.equal(lastRequest.method, 'POST')
    assert.equal(lastRequest.path, '/submissions/init')
    assert.equal(lastRequest.body.template_id, 1)
    assert.deepEqual(lastRequest.body.submitters, [{ email: 'a@b.com' }])
  })

  test('multiple submitters via -d', async () => {
    await cli('submissions', 'create', '--template-id', '1',
      '-d', 'submitters[0][email]=a@b.com',
      '-d', 'submitters[1][email]=c@d.com'
    )
    assert.deepEqual(lastRequest.body.submitters, [
      { email: 'a@b.com' },
      { email: 'c@d.com' },
    ])
  })

  test('submitter with role via -d', async () => {
    await cli('submissions', 'create', '--template-id', '1',
      '-d', 'submitters[0][email]=a@b.com',
      '-d', 'submitters[0][role]=Signer'
    )
    assert.deepEqual(lastRequest.body.submitters, [
      { email: 'a@b.com', role: 'Signer' },
    ])
  })

  test('--no-send-email', async () => {
    await cli('submissions', 'create', '--template-id', '1',
      '-d', 'submitters[0][email]=a@b.com', '--no-send-email'
    )
    assert.equal(lastRequest.body.send_email, false)
  })

  test('--send-sms', async () => {
    await cli('submissions', 'create', '--template-id', '1',
      '-d', 'submitters[0][email]=a@b.com', '--send-sms'
    )
    assert.equal(lastRequest.body.send_sms, true)
  })

  test('--order random', async () => {
    await cli('submissions', 'create', '--template-id', '1',
      '-d', 'submitters[0][email]=a@b.com', '--order', 'random'
    )
    assert.equal(lastRequest.body.order, 'random')
  })

  test('string flags', async () => {
    await cli('submissions', 'create', '--template-id', '1',
      '-d', 'submitters[0][email]=a@b.com',
      '--completed-redirect-url', 'https://done.com',
      '--bcc-completed', 'bcc@t.com',
      '--reply-to', 'reply@t.com',
      '--expire-at', '2025-12-31'
    )
    assert.equal(lastRequest.body.completed_redirect_url, 'https://done.com')
    assert.equal(lastRequest.body.bcc_completed, 'bcc@t.com')
    assert.equal(lastRequest.body.reply_to, 'reply@t.com')
    assert.equal(lastRequest.body.expire_at, '2025-12-31')
  })

  test('submitter fields via -d', async () => {
    await cli('submissions', 'create', '--template-id', '1',
      '-d', 'submitters[0][email]=a@b.com',
      '-d', 'submitters[0][fields][0][name]=First Name',
      '-d', 'submitters[0][fields][0][default_value]=John'
    )
    assert.deepEqual(lastRequest.body.submitters[0].fields, [
      { name: 'First Name', default_value: 'John' },
    ])
  })
})

// --- submissions send-emails ---

describe('submissions send-emails', () => {
  test('required flags', async () => {
    await cli('submissions', 'send-emails', '--template-id', '1', '--emails', 'a@b.com,c@d.com')
    assert.equal(lastRequest.method, 'POST')
    assert.equal(lastRequest.path, '/submissions/emails')
    assert.equal(lastRequest.body.template_id, 1)
    assert.equal(lastRequest.body.emails, 'a@b.com,c@d.com')
  })

  test('--no-send-email', async () => {
    await cli('submissions', 'send-emails', '--template-id', '1', '--emails', 'a@b.com', '--no-send-email')
    assert.equal(lastRequest.body.send_email, false)
  })
})

// --- submissions create-pdf ---

describe('submissions create-pdf', () => {
  let tmpFile

  before(() => {
    tmpFile = join(tmpdir(), 'docuseal-test.pdf')
    writeFileSync(tmpFile, 'fake-pdf')
  })

  after(() => unlinkSync(tmpFile))

  test('file upload with -d submitters', async () => {
    await cli('submissions', 'create-pdf', '--file', tmpFile, '-d', 'submitters[0][email]=a@b.com')
    assert.equal(lastRequest.method, 'POST')
    assert.equal(lastRequest.path, '/submissions/pdf')
    assert.equal(lastRequest.body.documents[0].name, 'docuseal-test.pdf')
    assert.ok(lastRequest.body.documents[0].file.startsWith('data:application/octet-stream;base64,'))
    assert.deepEqual(lastRequest.body.submitters, [{ email: 'a@b.com' }])
  })

  test('--name', async () => {
    await cli('submissions', 'create-pdf', '--file', tmpFile, '-d', 'submitters[0][email]=a@b.com', '--name', 'My Doc')
    assert.equal(lastRequest.body.name, 'My Doc')
  })

  test('boolean flags', async () => {
    await cli('submissions', 'create-pdf', '--file', tmpFile,
      '-d', 'submitters[0][email]=a@b.com',
      '--flatten', '--merge-documents', '--no-remove-tags'
    )
    assert.equal(lastRequest.body.flatten, true)
    assert.equal(lastRequest.body.merge_documents, true)
    assert.equal(lastRequest.body.remove_tags, false)
  })
})

// --- submissions create-docx ---

describe('submissions create-docx', () => {
  let tmpFile

  before(() => {
    tmpFile = join(tmpdir(), 'docuseal-test.docx')
    writeFileSync(tmpFile, 'fake-docx')
  })

  after(() => unlinkSync(tmpFile))

  test('file upload', async () => {
    await cli('submissions', 'create-docx', '--file', tmpFile, '-d', 'submitters[0][email]=a@b.com')
    assert.equal(lastRequest.method, 'POST')
    assert.equal(lastRequest.path, '/submissions/docx')
    assert.equal(lastRequest.body.documents[0].name, 'docuseal-test.docx')
    assert.ok(lastRequest.body.documents[0].file.startsWith('data:application/octet-stream;base64,'))
  })

  test('--merge-documents --no-remove-tags', async () => {
    await cli('submissions', 'create-docx', '--file', tmpFile,
      '-d', 'submitters[0][email]=a@b.com',
      '--merge-documents', '--no-remove-tags'
    )
    assert.equal(lastRequest.body.merge_documents, true)
    assert.equal(lastRequest.body.remove_tags, false)
  })
})

// --- submissions create-html ---

describe('submissions create-html', () => {
  let tmpFile

  before(() => {
    tmpFile = join(tmpdir(), 'docuseal-test.html')
    writeFileSync(tmpFile, '<p>{{name}}</p>')
  })

  after(() => unlinkSync(tmpFile))

  test('--html-file', async () => {
    await cli('submissions', 'create-html', '--html-file', tmpFile, '-d', 'submitters[0][email]=a@b.com')
    assert.equal(lastRequest.method, 'POST')
    assert.equal(lastRequest.path, '/submissions/html')
    assert.equal(lastRequest.body.html, '<p>{{name}}</p>')
    assert.deepEqual(lastRequest.body.submitters, [{ email: 'a@b.com' }])
  })
})

// --- submissions documents ---

describe('submissions documents', () => {
  test('passes id', async () => {
    await cli('submissions', 'documents', '42')
    assert.equal(lastRequest.method, 'GET')
    assert.equal(lastRequest.path, '/submissions/42/documents')
  })

  test('--merge', async () => {
    await cli('submissions', 'documents', '42', '--merge')
    assert.equal(lastRequest.query.merge, 'true')
  })

  test('--no-merge', async () => {
    await cli('submissions', 'documents', '42', '--no-merge')
    assert.equal(lastRequest.query.merge, 'false')
  })
})
