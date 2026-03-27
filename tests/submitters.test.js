import { createServer } from 'node:http'
import { execFile } from 'node:child_process'
import { join } from 'node:path'
import { describe, test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

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

// --- submitters list ---

describe('submitters list', () => {
  test('no flags', async () => {
    await cli('submitters', 'list')
    assert.equal(lastRequest.method, 'GET')
    assert.equal(lastRequest.path, '/submitters')
  })

  test('--submission-id', async () => {
    await cli('submitters', 'list', '--submission-id', '502')
    assert.equal(lastRequest.query.submission_id, '502')
  })

  test('--q', async () => {
    await cli('submitters', 'list', '--q', 'john')
    assert.equal(lastRequest.query.q, 'john')
  })

  test('--slug', async () => {
    await cli('submitters', 'list', '--slug', 'abc123')
    assert.equal(lastRequest.query.slug, 'abc123')
  })

  test('--completed-after', async () => {
    await cli('submitters', 'list', '--completed-after', '2025-01-01')
    assert.equal(lastRequest.query.completed_after, '2025-01-01')
  })

  test('--completed-before', async () => {
    await cli('submitters', 'list', '--completed-before', '2025-12-31')
    assert.equal(lastRequest.query.completed_before, '2025-12-31')
  })

  test('--external-id', async () => {
    await cli('submitters', 'list', '--external-id', 'ext-1')
    assert.equal(lastRequest.query.external_id, 'ext-1')
  })

  test('--limit and --after', async () => {
    await cli('submitters', 'list', '--limit', '25', '--after', '100')
    assert.equal(lastRequest.query.limit, '25')
    assert.equal(lastRequest.query.after, '100')
  })

  test('--before', async () => {
    await cli('submitters', 'list', '--before', '50')
    assert.equal(lastRequest.query.before, '50')
  })

  test('multiple flags combined', async () => {
    await cli('submitters', 'list', '--submission-id', '1', '--q', 'jane', '--limit', '5')
    assert.equal(lastRequest.query.submission_id, '1')
    assert.equal(lastRequest.query.q, 'jane')
    assert.equal(lastRequest.query.limit, '5')
  })
})

// --- submitters retrieve ---

describe('submitters retrieve', () => {
  test('passes id', async () => {
    await cli('submitters', 'retrieve', '201')
    assert.equal(lastRequest.method, 'GET')
    assert.equal(lastRequest.path, '/submitters/201')
  })
})

// --- submitters update ---

describe('submitters update', () => {
  test('--name', async () => {
    await cli('submitters', 'update', '201', '--name', 'John Doe')
    assert.equal(lastRequest.method, 'PUT')
    assert.equal(lastRequest.path, '/submitters/201')
    assert.equal(lastRequest.body.name, 'John Doe')
  })

  test('--email', async () => {
    await cli('submitters', 'update', '201', '--email', 'new@acme.com')
    assert.equal(lastRequest.body.email, 'new@acme.com')
  })

  test('--phone', async () => {
    await cli('submitters', 'update', '201', '--phone', '+1234567890')
    assert.equal(lastRequest.body.phone, '+1234567890')
  })

  test('--external-id', async () => {
    await cli('submitters', 'update', '201', '--external-id', 'ext-1')
    assert.equal(lastRequest.body.external_id, 'ext-1')
  })

  test('--send-email', async () => {
    await cli('submitters', 'update', '201', '--send-email')
    assert.equal(lastRequest.body.send_email, true)
  })

  test('--no-send-email', async () => {
    await cli('submitters', 'update', '201', '--no-send-email')
    assert.equal(lastRequest.body.send_email, false)
  })

  test('--send-sms', async () => {
    await cli('submitters', 'update', '201', '--send-sms')
    assert.equal(lastRequest.body.send_sms, true)
  })

  test('--no-send-sms', async () => {
    await cli('submitters', 'update', '201', '--no-send-sms')
    assert.equal(lastRequest.body.send_sms, false)
  })

  test('--reply-to', async () => {
    await cli('submitters', 'update', '201', '--reply-to', 'reply@t.com')
    assert.equal(lastRequest.body.reply_to, 'reply@t.com')
  })

  test('--completed', async () => {
    await cli('submitters', 'update', '201', '--completed')
    assert.equal(lastRequest.body.completed, true)
  })

  test('--no-completed', async () => {
    await cli('submitters', 'update', '201', '--no-completed')
    assert.equal(lastRequest.body.completed, false)
  })

  test('--completed-redirect-url', async () => {
    await cli('submitters', 'update', '201', '--completed-redirect-url', 'https://done.com')
    assert.equal(lastRequest.body.completed_redirect_url, 'https://done.com')
  })

  test('--require-phone-2fa', async () => {
    await cli('submitters', 'update', '201', '--require-phone-2fa')
    assert.equal(lastRequest.body.require_phone_2fa, true)
  })

  test('--no-require-phone-2fa', async () => {
    await cli('submitters', 'update', '201', '--no-require-phone-2fa')
    assert.equal(lastRequest.body.require_phone_2fa, false)
  })

  test('--require-email-2fa', async () => {
    await cli('submitters', 'update', '201', '--require-email-2fa')
    assert.equal(lastRequest.body.require_email_2fa, true)
  })

  test('--no-require-email-2fa', async () => {
    await cli('submitters', 'update', '201', '--no-require-email-2fa')
    assert.equal(lastRequest.body.require_email_2fa, false)
  })

  test('multiple flags combined', async () => {
    await cli('submitters', 'update', '201', '--name', 'Jane', '--email', 'jane@t.com', '--completed', '--send-email')
    assert.equal(lastRequest.body.name, 'Jane')
    assert.equal(lastRequest.body.email, 'jane@t.com')
    assert.equal(lastRequest.body.completed, true)
    assert.equal(lastRequest.body.send_email, true)
  })

  test('-d override', async () => {
    await cli('submitters', 'update', '201', '-d', 'metadata[key]=value')
    assert.deepEqual(lastRequest.body.metadata, { key: 'value' })
  })

  test('-d values, fields, message', async () => {
    await cli('submitters', 'update', '201',
      '-d', 'values[First Name]=John',
      '-d', 'values[Last Name]=Doe',
      '-d', 'fields[0][name]=First Name',
      '-d', 'fields[0][default_value]=John',
      '-d', 'fields[0][readonly]=true',
      '-d', 'fields[1][name]=Email',
      '-d', 'fields[1][required]=true',
      '-d', 'message[subject]=Please sign',
      '-d', 'message[body]=Hello, please sign this'
    )
    assert.deepEqual(lastRequest.body, {
      values: { 'First Name': 'John', 'Last Name': 'Doe' },
      fields: [
        { name: 'First Name', default_value: 'John', readonly: true },
        { name: 'Email', required: true },
      ],
      message: { subject: 'Please sign', body: 'Hello, please sign this' },
    })
  })

  test('flags + -d combined', async () => {
    await cli('submitters', 'update', '201',
      '--name', 'Jane Doe',
      '--email', 'jane@acme.com',
      '--completed',
      '--send-email',
      '-d', 'values[Name]=Jane',
      '-d', 'metadata[dept]=HR',
      '-d', 'fields[0][name]=Name',
      '-d', 'fields[0][readonly]=true',
      '-d', 'message[subject]=Updated',
      '-d', 'message[body]=Please review'
    )
    assert.deepEqual(lastRequest.body, {
      name: 'Jane Doe',
      email: 'jane@acme.com',
      completed: true,
      send_email: true,
      values: { Name: 'Jane' },
      metadata: { dept: 'HR' },
      fields: [{ name: 'Name', readonly: true }],
      message: { subject: 'Updated', body: 'Please review' },
    })
  })
})
