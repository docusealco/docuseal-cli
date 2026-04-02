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

  test('-d submitters with values, metadata, fields, message, variables', async () => {
    await cli('submissions', 'create', '--template-id', '1', '--order', 'random',
      '-d', 'submitters[0][email]=a@b.com',
      '-d', 'submitters[0][role]=Signer',
      '-d', 'submitters[0][values][First Name]=John',
      '-d', 'submitters[0][values][Last Name]=Doe',
      '-d', 'submitters[0][metadata][department]=Sales',
      '-d', 'submitters[0][metadata][id]=123',
      '-d', 'submitters[0][fields][0][name]=First Name',
      '-d', 'submitters[0][fields][0][default_value]=John',
      '-d', 'submitters[0][fields][0][readonly]=true',
      '-d', 'message[subject]=Please sign',
      '-d', 'message[body]=Hello',
      '-d', 'variables[company]=Acme'
    )
    assert.deepEqual(lastRequest.body, {
      template_id: 1,
      order: 'random',
      submitters: [{
        email: 'a@b.com',
        role: 'Signer',
        values: { 'First Name': 'John', 'Last Name': 'Doe' },
        metadata: { department: 'Sales', id: '123' },
        fields: [{ name: 'First Name', default_value: 'John', readonly: 'true' }],
      }],
      message: { subject: 'Please sign', body: 'Hello' },
      variables: { company: 'Acme' },
    })
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

  test('-d message', async () => {
    await cli('submissions', 'send-emails', '--template-id', '1', '--emails', 'a@b.com',
      '-d', 'message[subject]=Please sign',
      '-d', 'message[body]=Hello, please sign this document'
    )
    assert.deepEqual(lastRequest.body, {
      template_id: 1,
      emails: 'a@b.com',
      message: { subject: 'Please sign', body: 'Hello, please sign this document' },
    })
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
    assert.equal(lastRequest.body.documents[0].file, Buffer.from('fake-pdf').toString('base64'))
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

  test('-d submitters with roles, values, metadata, message', async () => {
    const b64 = Buffer.from('fake-pdf').toString('base64')
    await cli('submissions', 'create-pdf', '--file', tmpFile, '--name', 'My Doc',
      '-d', 'submitters[0][email]=a@b.com',
      '-d', 'submitters[0][role]=Signer',
      '-d', 'submitters[0][values][First Name]=John',
      '-d', 'submitters[0][metadata][dept]=Sales',
      '-d', 'submitters[1][email]=c@d.com',
      '-d', 'submitters[1][role]=Witness',
      '-d', 'message[subject]=Sign this',
      '-d', 'message[body]=Please review and sign'
    )
    assert.deepEqual(lastRequest.body, {
      name: 'My Doc',
      documents: [{
        name: 'docuseal-test.pdf',
        file: b64,
      }],
      submitters: [
        { email: 'a@b.com', role: 'Signer', values: { 'First Name': 'John' }, metadata: { dept: 'Sales' } },
        { email: 'c@d.com', role: 'Witness' },
      ],
      message: { subject: 'Sign this', body: 'Please review and sign' },
    })
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
    assert.equal(lastRequest.body.documents[0].file, Buffer.from('fake-docx').toString('base64'))
  })

  test('--merge-documents --no-remove-tags', async () => {
    await cli('submissions', 'create-docx', '--file', tmpFile,
      '-d', 'submitters[0][email]=a@b.com',
      '--merge-documents', '--no-remove-tags'
    )
    assert.equal(lastRequest.body.merge_documents, true)
    assert.equal(lastRequest.body.remove_tags, false)
  })

  test('-d submitters with fields, values, metadata, message', async () => {
    const b64 = Buffer.from('fake-docx').toString('base64')
    await cli('submissions', 'create-docx', '--file', tmpFile,
      '-d', 'submitters[0][email]=a@b.com',
      '-d', 'submitters[0][role]=Signer',
      '-d', 'submitters[0][fields][0][name]=First Name',
      '-d', 'submitters[0][fields][0][default_value]=John',
      '-d', 'submitters[0][fields][0][readonly]=true',
      '-d', 'submitters[0][values][Company]=Acme',
      '-d', 'submitters[0][metadata][dept]=Sales',
      '-d', 'message[subject]=Please sign',
      '-d', 'message[body]=Review and sign'
    )
    assert.deepEqual(lastRequest.body, {
      documents: [{
        name: 'docuseal-test.docx',
        file: b64,
      }],
      submitters: [{
        email: 'a@b.com',
        role: 'Signer',
        fields: [{ name: 'First Name', default_value: 'John', readonly: 'true' }],
        values: { Company: 'Acme' },
        metadata: { dept: 'Sales' },
      }],
      message: { subject: 'Please sign', body: 'Review and sign' },
    })
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

  test('--file', async () => {
    await cli('submissions', 'create-html', '--file', tmpFile, '-d', 'submitters[0][email]=a@b.com')
    assert.equal(lastRequest.method, 'POST')
    assert.equal(lastRequest.path, '/submissions/html')
    assert.equal(lastRequest.body.html, '<p>{{name}}</p>')
    assert.deepEqual(lastRequest.body.submitters, [{ email: 'a@b.com' }])
  })

  test('-d documents, submitters, message', async () => {
    await cli('submissions', 'create-html', '--name', 'HTML Sub',
      '-d', 'documents[0][html]=<p>{{name}}</p>',
      '-d', 'documents[0][name]=Page 1',
      '-d', 'submitters[0][email]=a@b.com',
      '-d', 'submitters[0][role]=Signer',
      '-d', 'submitters[0][values][Name]=John',
      '-d', 'message[subject]=Sign please',
      '-d', 'message[body]=Hello'
    )
    assert.deepEqual(lastRequest.body, {
      name: 'HTML Sub',
      documents: [{ html: '<p>{{name}}</p>', name: 'Page 1' }],
      submitters: [{ email: 'a@b.com', role: 'Signer', values: { Name: 'John' } }],
      message: { subject: 'Sign please', body: 'Hello' },
    })
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

})
