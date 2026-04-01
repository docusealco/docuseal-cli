import { createServer } from 'node:http'
import { execFile } from 'node:child_process'
import { writeFileSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
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
        path: req.url.split('?')[0].replace('/api', ''),
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
        DOCUSEAL_SERVER: `http://localhost:${port}/api`,
      },
    }, (err, stdout, stderr) => {
      resolve({ stdout, stderr, code: err?.code ?? 0 })
    })
  })
}

// --- templates list ---

describe('templates list', () => {
  test('no flags', async () => {
    await cli('templates', 'list')
    assert.equal(lastRequest.method, 'GET')
    assert.equal(lastRequest.path, '/templates')
  })

  test('--q', async () => {
    await cli('templates', 'list', '--q', 'NDA')
    assert.equal(lastRequest.query.q, 'NDA')
  })

  test('--slug', async () => {
    await cli('templates', 'list', '--slug', 'abc123')
    assert.equal(lastRequest.query.slug, 'abc123')
  })

  test('--external-id', async () => {
    await cli('templates', 'list', '--external-id', 'ext-1')
    assert.equal(lastRequest.query.external_id, 'ext-1')
  })

  test('--folder', async () => {
    await cli('templates', 'list', '--folder', 'Legal')
    assert.equal(lastRequest.query.folder, 'Legal')
  })

  test('--archived', async () => {
    await cli('templates', 'list', '--archived')
    assert.equal(lastRequest.query.archived, 'true')
  })

  test('--no-archived', async () => {
    await cli('templates', 'list', '--no-archived')
    assert.equal(lastRequest.query.archived, 'false')
  })

  test('--limit and --after', async () => {
    await cli('templates', 'list', '--limit', '25', '--after', '100')
    assert.equal(lastRequest.query.limit, '25')
    assert.equal(lastRequest.query.after, '100')
  })

  test('--before', async () => {
    await cli('templates', 'list', '--before', '50')
    assert.equal(lastRequest.query.before, '50')
  })

  test('multiple flags combined', async () => {
    await cli('templates', 'list', '--folder', 'HR', '--q', 'offer', '--limit', '5')
    assert.equal(lastRequest.query.folder, 'HR')
    assert.equal(lastRequest.query.q, 'offer')
    assert.equal(lastRequest.query.limit, '5')
  })
})

// --- templates retrieve ---

describe('templates retrieve', () => {
  test('passes id', async () => {
    await cli('templates', 'retrieve', '1001')
    assert.equal(lastRequest.method, 'GET')
    assert.equal(lastRequest.path, '/templates/1001')
  })
})

// --- templates update ---

describe('templates update', () => {
  test('--name', async () => {
    await cli('templates', 'update', '1001', '--name', 'NDA v2')
    assert.equal(lastRequest.method, 'PUT')
    assert.equal(lastRequest.path, '/templates/1001')
    assert.equal(lastRequest.body.name, 'NDA v2')
  })

  test('--folder-name', async () => {
    await cli('templates', 'update', '1001', '--folder-name', 'Contracts')
    assert.equal(lastRequest.body.folder_name, 'Contracts')
  })

  test('--archived', async () => {
    await cli('templates', 'update', '1001', '--archived')
    assert.equal(lastRequest.body.archived, true)
  })

  test('--no-archived', async () => {
    await cli('templates', 'update', '1001', '--no-archived')
    assert.equal(lastRequest.body.archived, false)
  })

  test('-d override', async () => {
    await cli('templates', 'update', '1001', '-d', 'name=Custom')
    assert.equal(lastRequest.body.name, 'Custom')
  })

  test('-d roles[]', async () => {
    await cli('templates', 'update', '1001',
      '-d', 'roles[]=Signer',
      '-d', 'roles[]=Reviewer'
    )
    assert.deepEqual(lastRequest.body, { roles: ['Signer', 'Reviewer'] })
  })
})

// --- templates archive ---

describe('templates archive', () => {
  test('passes id', async () => {
    await cli('templates', 'archive', '1001')
    assert.equal(lastRequest.method, 'DELETE')
    assert.equal(lastRequest.path, '/templates/1001')
  })
})

// --- templates create-pdf ---

describe('templates create-pdf', () => {
  let tmpFile

  before(() => {
    tmpFile = join(tmpdir(), 'docuseal-tpl-test.pdf')
    writeFileSync(tmpFile, 'fake-pdf')
  })

  after(() => unlinkSync(tmpFile))

  test('file upload', async () => {
    await cli('templates', 'create-pdf', '--file', tmpFile)
    assert.equal(lastRequest.method, 'POST')
    assert.equal(lastRequest.path, '/templates/pdf')
    assert.equal(lastRequest.body.documents[0].name, 'docuseal-tpl-test.pdf')
    assert.ok(lastRequest.body.documents[0].file.startsWith('data:application/octet-stream;base64,'))
  })

  test('--name', async () => {
    await cli('templates', 'create-pdf', '--file', tmpFile, '--name', 'NDA')
    assert.equal(lastRequest.body.name, 'NDA')
  })

  test('--folder-name', async () => {
    await cli('templates', 'create-pdf', '--file', tmpFile, '--folder-name', 'Legal')
    assert.equal(lastRequest.body.folder_name, 'Legal')
  })

  test('--external-id', async () => {
    await cli('templates', 'create-pdf', '--file', tmpFile, '--external-id', 'ext-1')
    assert.equal(lastRequest.body.external_id, 'ext-1')
  })

  test('--shared-link', async () => {
    await cli('templates', 'create-pdf', '--file', tmpFile, '--shared-link')
    assert.equal(lastRequest.body.shared_link, true)
  })

  test('--no-shared-link', async () => {
    await cli('templates', 'create-pdf', '--file', tmpFile, '--no-shared-link')
    assert.equal(lastRequest.body.shared_link, false)
  })

  test('-d documents with fields and areas', async () => {
    const b64 = Buffer.from('fake-pdf').toString('base64')
    await cli('templates', 'create-pdf', '--file', tmpFile, '--name', 'NDA',
      '-d', 'documents[0][fields][0][name]=Name',
      '-d', 'documents[0][fields][0][type]=text',
      '-d', 'documents[0][fields][0][role]=Signer',
      '-d', 'documents[0][fields][0][required]=true',
      '-d', 'documents[0][fields][1][name]=Signature',
      '-d', 'documents[0][fields][1][type]=signature',
      '-d', 'documents[0][fields][1][areas][0][x]=0.1',
      '-d', 'documents[0][fields][1][areas][0][y]=0.5',
      '-d', 'documents[0][fields][1][areas][0][w]=0.3',
      '-d', 'documents[0][fields][1][areas][0][h]=0.05',
      '-d', 'documents[0][fields][1][areas][0][page]=1'
    )
    assert.deepEqual(lastRequest.body, {
      name: 'NDA',
      documents: [{
        name: 'docuseal-tpl-test.pdf',
        file: `data:application/octet-stream;base64,${b64}`,
        fields: [
          { name: 'Name', type: 'text', role: 'Signer', required: 'true' },
          { name: 'Signature', type: 'signature', areas: [{ x: '0.1', y: '0.5', w: '0.3', h: '0.05', page: '1' }] },
        ],
      }],
    })
  })
})

// --- templates create-docx ---

describe('templates create-docx', () => {
  let tmpFile

  before(() => {
    tmpFile = join(tmpdir(), 'docuseal-tpl-test.docx')
    writeFileSync(tmpFile, 'fake-docx')
  })

  after(() => unlinkSync(tmpFile))

  test('file upload', async () => {
    await cli('templates', 'create-docx', '--file', tmpFile)
    assert.equal(lastRequest.method, 'POST')
    assert.equal(lastRequest.path, '/templates/docx')
    assert.equal(lastRequest.body.documents[0].name, 'docuseal-tpl-test.docx')
    assert.ok(lastRequest.body.documents[0].file.startsWith('data:application/octet-stream;base64,'))
  })

  test('--name and --folder-name', async () => {
    await cli('templates', 'create-docx', '--file', tmpFile, '--name', 'Contract', '--folder-name', 'HR')
    assert.equal(lastRequest.body.name, 'Contract')
    assert.equal(lastRequest.body.folder_name, 'HR')
  })

  test('--external-id', async () => {
    await cli('templates', 'create-docx', '--file', tmpFile, '--external-id', 'ext-2')
    assert.equal(lastRequest.body.external_id, 'ext-2')
  })

  test('--shared-link', async () => {
    await cli('templates', 'create-docx', '--file', tmpFile, '--shared-link')
    assert.equal(lastRequest.body.shared_link, true)
  })

  test('-d documents with fields and areas', async () => {
    const b64 = Buffer.from('fake-docx').toString('base64')
    await cli('templates', 'create-docx', '--file', tmpFile, '--name', 'Contract',
      '-d', 'documents[0][fields][0][name]=Date',
      '-d', 'documents[0][fields][0][type]=date',
      '-d', 'documents[0][fields][0][role]=Signer',
      '-d', 'documents[0][fields][0][required]=true',
      '-d', 'documents[0][fields][1][name]=Signature',
      '-d', 'documents[0][fields][1][type]=signature',
      '-d', 'documents[0][fields][1][areas][0][x]=0.2',
      '-d', 'documents[0][fields][1][areas][0][y]=0.8',
      '-d', 'documents[0][fields][1][areas][0][w]=0.3',
      '-d', 'documents[0][fields][1][areas][0][h]=0.05',
      '-d', 'documents[0][fields][1][areas][0][page]=2'
    )
    assert.deepEqual(lastRequest.body, {
      name: 'Contract',
      documents: [{
        name: 'docuseal-tpl-test.docx',
        file: `data:application/octet-stream;base64,${b64}`,
        fields: [
          { name: 'Date', type: 'date', role: 'Signer', required: 'true' },
          { name: 'Signature', type: 'signature', areas: [{ x: '0.2', y: '0.8', w: '0.3', h: '0.05', page: '2' }] },
        ],
      }],
    })
  })
})

// --- templates create-html ---

describe('templates create-html', () => {
  let tmpFile

  before(() => {
    tmpFile = join(tmpdir(), 'docuseal-tpl-test.html')
    writeFileSync(tmpFile, '<p>{{name}}</p>')
  })

  after(() => unlinkSync(tmpFile))

  test('--html', async () => {
    await cli('templates', 'create-html', '--html', '<p>{{field}}</p>')
    assert.equal(lastRequest.method, 'POST')
    assert.equal(lastRequest.path, '/templates/html')
    assert.equal(lastRequest.body.html, '<p>{{field}}</p>')
  })

  test('--file', async () => {
    await cli('templates', 'create-html', '--file', tmpFile)
    assert.equal(lastRequest.body.html, '<p>{{name}}</p>')
  })

  test('--html-header and --html-footer', async () => {
    await cli('templates', 'create-html', '--html', '<p>body</p>', '--html-header', '<h1>Header</h1>', '--html-footer', '<footer>F</footer>')
    assert.equal(lastRequest.body.html_header, '<h1>Header</h1>')
    assert.equal(lastRequest.body.html_footer, '<footer>F</footer>')
  })

  test('--name', async () => {
    await cli('templates', 'create-html', '--html', '<p>x</p>', '--name', 'Simple')
    assert.equal(lastRequest.body.name, 'Simple')
  })

  test('--size', async () => {
    await cli('templates', 'create-html', '--html', '<p>x</p>', '--size', 'A4')
    assert.equal(lastRequest.body.size, 'A4')
  })

  test('--external-id', async () => {
    await cli('templates', 'create-html', '--html', '<p>x</p>', '--external-id', 'ext-3')
    assert.equal(lastRequest.body.external_id, 'ext-3')
  })

  test('--folder-name', async () => {
    await cli('templates', 'create-html', '--html', '<p>x</p>', '--folder-name', 'Legal')
    assert.equal(lastRequest.body.folder_name, 'Legal')
  })

  test('--shared-link', async () => {
    await cli('templates', 'create-html', '--html', '<p>x</p>', '--shared-link')
    assert.equal(lastRequest.body.shared_link, true)
  })

  test('-d documents with html', async () => {
    await cli('templates', 'create-html', '--name', 'Multi-page', '--folder-name', 'Legal',
      '-d', 'documents[0][html]=<p>{{name}}</p>',
      '-d', 'documents[0][name]=Page 1',
      '-d', 'documents[1][html]=<p>{{signature}}</p>',
      '-d', 'documents[1][name]=Page 2'
    )
    assert.deepEqual(lastRequest.body, {
      name: 'Multi-page',
      folder_name: 'Legal',
      documents: [
        { html: '<p>{{name}}</p>', name: 'Page 1' },
        { html: '<p>{{signature}}</p>', name: 'Page 2' },
      ],
    })
  })
})

// --- templates clone ---

describe('templates clone', () => {
  test('passes id', async () => {
    await cli('templates', 'clone', '1001')
    assert.equal(lastRequest.method, 'POST')
    assert.equal(lastRequest.path, '/templates/1001/clone')
  })

  test('--name', async () => {
    await cli('templates', 'clone', '1001', '--name', 'NDA Copy')
    assert.equal(lastRequest.body.name, 'NDA Copy')
  })

  test('--folder-name', async () => {
    await cli('templates', 'clone', '1001', '--folder-name', 'Archive')
    assert.equal(lastRequest.body.folder_name, 'Archive')
  })

  test('--external-id', async () => {
    await cli('templates', 'clone', '1001', '--external-id', 'ext-4')
    assert.equal(lastRequest.body.external_id, 'ext-4')
  })
})

// --- templates merge ---

describe('templates merge', () => {
  test('template_ids via -d', async () => {
    await cli('templates', 'merge', '-d', 'template_ids[]=1', '-d', 'template_ids[]=2')
    assert.equal(lastRequest.method, 'POST')
    assert.equal(lastRequest.path, '/templates/merge')
    assert.deepEqual(lastRequest.body.template_ids, ['1', '2'])
  })

  test('--name', async () => {
    await cli('templates', 'merge', '--name', 'Combined', '-d', 'template_ids[]=1')
    assert.equal(lastRequest.body.name, 'Combined')
  })

  test('--folder-name', async () => {
    await cli('templates', 'merge', '--folder-name', 'Merged', '-d', 'template_ids[]=1')
    assert.equal(lastRequest.body.folder_name, 'Merged')
  })

  test('--external-id', async () => {
    await cli('templates', 'merge', '--external-id', 'ext-5', '-d', 'template_ids[]=1')
    assert.equal(lastRequest.body.external_id, 'ext-5')
  })

  test('--shared-link', async () => {
    await cli('templates', 'merge', '--shared-link', '-d', 'template_ids[]=1')
    assert.equal(lastRequest.body.shared_link, true)
  })
})

// --- templates update-documents ---

describe('templates update-documents', () => {
  test('passes id', async () => {
    await cli('templates', 'update-documents', '1001')
    assert.equal(lastRequest.method, 'PUT')
    assert.equal(lastRequest.path, '/templates/1001/documents')
  })

  test('--merge', async () => {
    await cli('templates', 'update-documents', '1001', '--merge')
    assert.equal(lastRequest.body.merge, true)
  })

  test('--no-merge', async () => {
    await cli('templates', 'update-documents', '1001', '--no-merge')
    assert.equal(lastRequest.body.merge, false)
  })

  test('-d documents with --merge', async () => {
    await cli('templates', 'update-documents', '1001', '--merge',
      '-d', 'documents[0][file]=https://example.com/doc.pdf',
      '-d', 'documents[0][name]=New Doc',
      '-d', 'documents[1][html]=<p>Page 2</p>',
      '-d', 'documents[1][name]=HTML Page',
      '-d', 'documents[1][position]=1'
    )
    assert.deepEqual(lastRequest.body, {
      merge: true,
      documents: [
        { file: 'https://example.com/doc.pdf', name: 'New Doc' },
        { html: '<p>Page 2</p>', name: 'HTML Page', position: '1' },
      ],
    })
  })
})
