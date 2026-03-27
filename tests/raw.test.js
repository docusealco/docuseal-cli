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

// --- get ---

describe('get', () => {
  test('simple path', async () => {
    await cli('get', '/templates')
    assert.equal(lastRequest.method, 'GET')
    assert.equal(lastRequest.path, '/templates')
  })

  test('path with id', async () => {
    await cli('get', '/submissions/1')
    assert.equal(lastRequest.method, 'GET')
    assert.equal(lastRequest.path, '/submissions/1')
  })

  test('-d adds query params', async () => {
    await cli('get', '/templates', '-d', 'folder=Legal', '-d', 'limit=10')
    assert.equal(lastRequest.method, 'GET')
    assert.equal(lastRequest.query.folder, 'Legal')
    assert.equal(lastRequest.query.limit, '10')
  })
})

// --- post ---

describe('post', () => {
  test('path with -d body', async () => {
    await cli('post', '/submissions/init', '-d', 'template_id=1001', '-d', 'submitters[0][email]=john@acme.com')
    assert.equal(lastRequest.method, 'POST')
    assert.equal(lastRequest.path, '/submissions/init')
    assert.deepEqual(lastRequest.body, {
      template_id: 1001,
      submitters: [{ email: 'john@acme.com' }],
    })
  })

  test('no -d sends no body', async () => {
    await cli('post', '/templates/1/clone')
    assert.equal(lastRequest.method, 'POST')
    assert.equal(lastRequest.path, '/templates/1/clone')
    assert.equal(lastRequest.body, undefined)
  })
})

// --- put ---

describe('put', () => {
  test('path with -d body', async () => {
    await cli('put', '/templates/1', '-d', 'name=NDA v2')
    assert.equal(lastRequest.method, 'PUT')
    assert.equal(lastRequest.path, '/templates/1')
    assert.deepEqual(lastRequest.body, { name: 'NDA v2' })
  })
})

// --- delete ---

describe('delete', () => {
  test('simple path', async () => {
    await cli('delete', '/templates/1')
    assert.equal(lastRequest.method, 'DELETE')
    assert.equal(lastRequest.path, '/templates/1')
  })
})

// --- auth header ---

describe('auth', () => {
  test('sends X-Auth-Token header', async () => {
    await cli('get', '/templates')
    assert.equal(lastRequest.headers['x-auth-token'], 'test-key')
  })
})
