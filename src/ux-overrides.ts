export type CustomFlag = {
  type: 'string' | 'boolean' | 'integer'
  description: string
  required?: boolean
  char?: string
  mapsTo?: string
}

export type CommandOverride = {
  customFlags?: Record<string, CustomFlag>
  examples?: string[]
}

export const overrides: Record<string, CommandOverride> = {

  // ── TEMPLATES ────────────────────────────────────────────────────

  'GET /templates': {
    examples: [
      'docuseal templates list',
      'docuseal templates list --folder Legal --limit 50',
      'docuseal templates list --archived',
      'docuseal templates list | jq \'.data[].id\'',
    ],
  },

  'GET /templates/{id}': {
    examples: [
      'docuseal templates retrieve 1001',
    ],
  },

  'PUT /templates/{id}': {
    examples: [
      'docuseal templates update 1001 --name "NDA v2"',
      'docuseal templates update 1001 --folder-name Contracts',
      'docuseal templates update 1001 --no-archived',
    ],
  },

  'DELETE /templates/{id}': {
    examples: ['docuseal templates archive 1001'],
  },

  'POST /templates/pdf': {
    customFlags: {
      file: {
        type: 'string',
        description: 'Path to local PDF file',
        required: true,
        mapsTo: 'documents[0].file',
      },
    },
    examples: [
      'docuseal templates create-pdf --file contract.pdf --name "NDA"',
      'docuseal templates create-pdf --file form.pdf --folder-name Legal',
    ],
  },

  'POST /templates/docx': {
    customFlags: {
      file: {
        type: 'string',
        description: 'Path to local DOCX file',
        required: true,
        mapsTo: 'documents[0].file',
      },
    },
    examples: [
      'docuseal templates create-docx --file template.docx --name "Contract"',
    ],
  },

  'POST /templates/html': {
    customFlags: {
      'html-file': {
        type: 'string',
        description: 'Path to local HTML file (alternative to --html)',
        mapsTo: 'html',
      },
    },
    examples: [
      'docuseal templates create-html --html "<p>{{name}}</p>" --name "Simple"',
      'docuseal templates create-html --html-file template.html --name "Contract"',
    ],
  },

  'POST /templates/{id}/clone': {
    examples: [
      'docuseal templates clone 1001',
      'docuseal templates clone 1001 --name "NDA Copy"',
    ],
  },

  'POST /templates/merge': {
    examples: [
      'docuseal templates merge --template-ids 1001,1002',
      'docuseal templates merge --template-ids 1001,1002 --name "Combined"',
    ],
  },

  'PUT /templates/{id}/documents': {
    examples: [
      'docuseal templates update-documents 1001',
    ],
  },

  // ── SUBMISSIONS ──────────────────────────────────────────────────

  'GET /submissions': {
    examples: [
      'docuseal submissions list',
      'docuseal submissions list --status pending',
      'docuseal submissions list --template-id 1001 --limit 50',
      'docuseal submissions list | jq \'.data[].id\'',
    ],
  },

  'GET /submissions/{id}': {
    examples: [
      'docuseal submissions retrieve 502',
    ],
  },

  'DELETE /submissions/{id}': {
    examples: ['docuseal submissions archive 502'],
  },

  'POST /submissions': {
    examples: [
      'docuseal submissions create --template-id 1001 -d "submitters[0][email]=john@acme.com"',
      'docuseal submissions create --template-id 1001 -d "submitters[0][email]=a@b.com" -d "submitters[1][email]=c@d.com"',
      'docuseal submissions create --template-id 1001 -d "submitters[0][email]=john@acme.com" -d "submitters[0][role]=Signer"',
      'docuseal submissions create --template-id 1001 -d "submitters[0][email]=john@acme.com" --no-send-email',
    ],
  },

  'POST /submissions/emails': {
    examples: [
      'docuseal submissions send-emails --template-id 1001 --emails a@b.com,c@d.com',
    ],
  },

  'POST /submissions/pdf': {
    customFlags: {
      file: {
        type: 'string',
        description: 'Path to local PDF file',
        required: true,
        mapsTo: 'documents[0].file',
      },
    },
    examples: [
      'docuseal submissions create-pdf --file doc.pdf -d "submitters[0][email]=john@acme.com"',
    ],
  },

  'POST /submissions/docx': {
    customFlags: {
      file: {
        type: 'string',
        description: 'Path to local DOCX file',
        required: true,
        mapsTo: 'documents[0].file',
      },
    },
    examples: [
      'docuseal submissions create-docx --file doc.docx -d "submitters[0][email]=john@acme.com"',
    ],
  },

  'POST /submissions/html': {
    customFlags: {
      'html-file': {
        type: 'string',
        description: 'Path to local HTML file',
        mapsTo: 'html',
      },
    },
    examples: [
      'docuseal submissions create-html --html "<p>{{name}}</p>" -d "submitters[0][email]=john@acme.com"',
    ],
  },

  'GET /submissions/{id}/documents': {
    examples: [
      'docuseal submissions documents 502',
      'docuseal submissions documents 502 --merge',
    ],
  },

  // ── SUBMITTERS ───────────────────────────────────────────────────

  'GET /submitters': {
    examples: [
      'docuseal submitters list',
      'docuseal submitters list --submission-id 502',
    ],
  },

  'GET /submitters/{id}': {
    examples: [
      'docuseal submitters retrieve 201',
    ],
  },

  'PUT /submitters/{id}': {
    examples: [
      'docuseal submitters update 201 --email new@acme.com',
      'docuseal submitters update 201 --completed',
    ],
  },
}
