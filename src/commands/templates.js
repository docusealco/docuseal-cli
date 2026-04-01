import { Option } from 'commander'
import { readFileSync } from 'fs'
import { createClient, onError } from '../lib/api.js'
import { renderJson } from '../lib/output.js'
import { parseDataFlags, deepMerge } from '../lib/data-flags.js'
import { withGlobalOptions, formatDataParams, formatExamples } from '../lib/global-options.js'

export function registerTemplateCommands(program) {
  const topic = program.command('templates').description('Manage templates')

  withGlobalOptions(topic.command('list'))
    .description('List all templates')
    .addOption(new Option('--q <value>', 'Filter templates based on the name partial match.'))
    .addOption(new Option('--slug <value>', 'Filter templates by unique slug.'))
    .addOption(new Option('--external-id <value>', 'The unique applications-specific identifier provided for the template via API or Embedded template form builder. It allows you to receive only templates with your specified external id.'))
    .addOption(new Option('--folder <value>', 'Filter templates by folder name.'))
    .option('--archived', 'Get only archived templates instead of active ones.')
    .option('--no-archived', '')
    .addOption(new Option('-l, --limit <value>', 'The number of templates to return. Default value is 10. Maximum value is 100.').argParser(parseInt))
    .addOption(new Option('-a, --after <value>', 'The unique identifier of the template to start the list from. It allows you to receive only templates with id greater than the specified value. Pass ID value from the `pagination.next` response to load the next batch of templates.').argParser(parseInt))
    .addOption(new Option('--before <value>', 'The unique identifier of the template to end the list with. It allows you to receive only templates with id less than the specified value.').argParser(parseInt))
    .option('-d, --data <value>', 'Set parameters using bracket notation', (val, prev) => prev.concat([val]), [])
    .addHelpText('afterAll', formatExamples([
      'docuseal templates list',
      'docuseal templates list --folder Legal --limit 50',
      'docuseal templates list --archived',
    ]))
    .action(async (opts) => {
      const query = {}
      if (opts.q !== undefined) query['q'] = opts.q
      if (opts.slug !== undefined) query['slug'] = opts.slug
      if (opts.externalId !== undefined) query['external_id'] = opts.externalId
      if (opts.folder !== undefined) query['folder'] = opts.folder
      if (opts.archived !== undefined) query['archived'] = opts.archived
      if (opts.limit !== undefined) query['limit'] = opts.limit
      if (opts.after !== undefined) query['after'] = opts.after
      if (opts.before !== undefined) query['before'] = opts.before
      if (opts.data.length > 0) Object.assign(query, parseDataFlags(opts.data))

      createClient(opts).listTemplates(query).then(renderJson, onError)
    })

  withGlobalOptions(topic.command('retrieve'))
    .description('Get a template')
    .argument('<id>', 'The id of the template')
    .addHelpText('afterAll', formatExamples([
      'docuseal templates retrieve 1001',
    ]))
    .action(async (id, opts) => {
      createClient(opts).getTemplate(id).then(renderJson, onError)
    })

  withGlobalOptions(topic.command('update'))
    .description('Update a template')
    .argument('<id>', 'The id of the template')
    .addOption(new Option('--name <value>', 'The name of the template'))
    .addOption(new Option('--folder-name <value>', 'The folder\'s name to which the template should be moved.'))
    .option('--archived', 'Archive or unarchive the template.')
    .option('--no-archived', '')
    .option('-d, --data <value>', 'Set body parameters using bracket notation', (val, prev) => prev.concat([val]), [])
    .addHelpText('after', formatDataParams([
      ['roles[]', 'Submitter role name'],
    ]))
    .addHelpText('afterAll', formatExamples([
      'docuseal templates update 1001 --name "NDA v2"',
      'docuseal templates update 1001 --folder-name Contracts',
      'docuseal templates update 1001 -d "roles[]=Signer" -d "roles[]=Reviewer"',
      'docuseal templates update 1001 --no-archived',
    ]))
    .action(async (id, opts) => {
      const body = {}
      if (opts.name !== undefined) body['name'] = opts.name
      if (opts.folderName !== undefined) body['folder_name'] = opts.folderName
      if (opts.archived !== undefined) body['archived'] = opts.archived
      if (opts.data.length > 0) deepMerge(body, parseDataFlags(opts.data))

      createClient(opts).updateTemplate(id, body).then(renderJson, onError)
    })

  withGlobalOptions(topic.command('archive'))
    .description('Archive a template')
    .argument('<id>', 'The id of the template')
    .addHelpText('afterAll', formatExamples([
      'docuseal templates archive 1001',
    ]))
    .action(async (id, opts) => {
      createClient(opts).archiveTemplate(id).then(renderJson, onError)
    })

  withGlobalOptions(topic.command('create-pdf'))
    .description('Create a template from PDF (Pro)')
    .addOption(new Option('--name <value>', 'Name of the template'))
    .addOption(new Option('--folder-name <value>', 'The folder\'s name in which the template should be created.'))
    .addOption(new Option('--external-id <value>', 'Your application-specific unique string key to identify this template within your app. Existing template with specified `external_id` will be updated with a new PDF.'))
    .option('--shared-link', 'Make the template available via a shared link.')
    .option('--no-shared-link', '')
    .option('--flatten', 'Remove PDF form fields from the documents.')
    .option('--no-flatten', '')
    .option('--remove-tags', 'Remove {{text}} tags from the PDF (enabled by default).')
    .option('--no-remove-tags', '')
    .addOption(new Option('--file <value>', 'Path to local PDF file').makeOptionMandatory())
    .option('-d, --data <value>', 'Set body parameters using bracket notation', (val, prev) => prev.concat([val]), [])
    .addHelpText('after', formatDataParams([
      ['documents[N][name]', 'Document name'],
      ['documents[N][file]', 'Base64-encoded file or URL'],
      ['documents[N][fields][M][name]', 'Field name'],
      ['documents[N][fields][M][type]', 'text, signature, initials, date, number, image, checkbox, multiple, file, radio, select, cells, stamp, payment, phone'],
      ['documents[N][fields][M][role]', 'Signer role name'],
      ['documents[N][fields][M][required]', 'Required (true/false)'],
      ['documents[N][fields][M][title]', 'Display title (Markdown)'],
      ['documents[N][fields][M][description]', 'Display description (Markdown)'],
      ['documents[N][fields][M][options][]', 'Select/radio option values'],
      ['documents[N][fields][M][areas][K][x]', 'X coordinate (0-1)'],
      ['documents[N][fields][M][areas][K][y]', 'Y coordinate (0-1)'],
      ['documents[N][fields][M][areas][K][w]', 'Width (0-1)'],
      ['documents[N][fields][M][areas][K][h]', 'Height (0-1)'],
      ['documents[N][fields][M][areas][K][page]', 'Page number (starts from 1)'],
    ]))
    .addHelpText('afterAll', formatExamples([
      'docuseal templates create-pdf --file contract.pdf --name "NDA"',
      'docuseal templates create-pdf --file form.pdf --folder-name Legal',
      'docuseal templates create-pdf -d "documents[0][file]=./contract.pdf" --name "NDA"',
      'docuseal templates create-pdf -d "documents[0][file]=https://example.com/contract.pdf" --name "NDA"',
      'docuseal templates create-pdf --file form.pdf -d "documents[0][fields][0][name]=Name" -d "documents[0][fields][0][type]=text"',
    ]))
    .action(async (opts) => {
      const body = {}
      if (opts.name !== undefined) body['name'] = opts.name
      if (opts.folderName !== undefined) body['folder_name'] = opts.folderName
      if (opts.externalId !== undefined) body['external_id'] = opts.externalId
      if (opts.sharedLink !== undefined) body['shared_link'] = opts.sharedLink
      if (opts.flatten !== undefined) body['flatten'] = opts.flatten
      if (opts.removeTags !== undefined) body['remove_tags'] = opts.removeTags
      if (opts.file !== undefined) {
        const fileContent = readFileSync(opts.file)
        const base64 = Buffer.from(fileContent).toString('base64')
        const fileName = opts.file.split('/').pop() || 'document'
        body.documents = [{ name: fileName, file: `data:application/octet-stream;base64,${base64}` }]
      }
      if (opts.data.length > 0) deepMerge(body, parseDataFlags(opts.data))

      createClient(opts).createTemplateFromPdf(body).then(renderJson, onError)
    })

  withGlobalOptions(topic.command('create-docx'))
    .description('Create a template from Word DOCX (Pro)')
    .addOption(new Option('--name <value>', 'Name of the template'))
    .addOption(new Option('--external-id <value>', 'Your application-specific unique string key to identify this template within your app. Existing template with specified `external_id` will be updated with a new document.'))
    .addOption(new Option('--folder-name <value>', 'The folder\'s name in which the template should be created.'))
    .option('--shared-link', 'Make the template available via a shared link.')
    .option('--no-shared-link', '')
    .addOption(new Option('--file <value>', 'Path to local DOCX file').makeOptionMandatory())
    .option('-d, --data <value>', 'Set body parameters using bracket notation', (val, prev) => prev.concat([val]), [])
    .addHelpText('after', formatDataParams([
      ['documents[N][name]', 'Document name'],
      ['documents[N][file]', 'Base64-encoded file or URL'],
      ['documents[N][fields][M][name]', 'Field name'],
      ['documents[N][fields][M][type]', 'text, signature, initials, date, number, image, checkbox, multiple, file, radio, select, cells, stamp, payment, phone'],
      ['documents[N][fields][M][role]', 'Signer role name'],
      ['documents[N][fields][M][required]', 'Required (true/false)'],
      ['documents[N][fields][M][title]', 'Display title (Markdown)'],
      ['documents[N][fields][M][description]', 'Display description (Markdown)'],
      ['documents[N][fields][M][options][]', 'Select/radio option values'],
      ['documents[N][fields][M][areas][K][x]', 'X coordinate (0-1)'],
      ['documents[N][fields][M][areas][K][y]', 'Y coordinate (0-1)'],
      ['documents[N][fields][M][areas][K][w]', 'Width (0-1)'],
      ['documents[N][fields][M][areas][K][h]', 'Height (0-1)'],
      ['documents[N][fields][M][areas][K][page]', 'Page number (starts from 1)'],
    ]))
    .addHelpText('afterAll', formatExamples([
      'docuseal templates create-docx --file template.docx --name "Contract"',
      'docuseal templates create-docx -d "documents[0][file]=./template.docx" --name "Contract"',
      'docuseal templates create-docx -d "documents[0][file]=https://example.com/template.docx" --name "Contract"',
      'docuseal templates create-docx --file template.docx -d "documents[0][fields][0][name]=Name" -d "documents[0][fields][0][role]=Signer"',
    ]))
    .action(async (opts) => {
      const body = {}
      if (opts.name !== undefined) body['name'] = opts.name
      if (opts.externalId !== undefined) body['external_id'] = opts.externalId
      if (opts.folderName !== undefined) body['folder_name'] = opts.folderName
      if (opts.sharedLink !== undefined) body['shared_link'] = opts.sharedLink
      if (opts.file !== undefined) {
        const fileContent = readFileSync(opts.file)
        const base64 = Buffer.from(fileContent).toString('base64')
        const fileName = opts.file.split('/').pop() || 'document'
        body.documents = [{ name: fileName, file: `data:application/octet-stream;base64,${base64}` }]
      }
      if (opts.data.length > 0) deepMerge(body, parseDataFlags(opts.data))

      createClient(opts).createTemplateFromDocx(body).then(renderJson, onError)
    })

  withGlobalOptions(topic.command('create-html'))
    .description('Create a template from HTML (Pro)')
    .addOption(new Option('--html <value>', 'HTML template with field tags.'))
    .addOption(new Option('--html-header <value>', 'HTML template of the header to be displayed on every page.'))
    .addOption(new Option('--html-footer <value>', 'HTML template of the footer to be displayed on every page.'))
    .addOption(new Option('--name <value>', 'Template name. Random uuid will be assigned when not specified.'))
    .addOption(new Option('--size <value>', 'Page size. Letter 8.5 x 11 will be assigned when not specified.').choices(['Letter', 'Legal', 'Tabloid', 'Ledger', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6']))
    .addOption(new Option('--external-id <value>', 'Your application-specific unique string key to identify this template within your app. Existing template with specified `external_id` will be updated with a new HTML.'))
    .addOption(new Option('--folder-name <value>', 'The folder\'s name in which the template should be created.'))
    .option('--shared-link', 'Make the template available via a shared link.')
    .option('--no-shared-link', '')
    .addOption(new Option('--file <value>', 'Path to local HTML file (alternative to --html)'))
    .option('-d, --data <value>', 'Set body parameters using bracket notation', (val, prev) => prev.concat([val]), [])
    .addHelpText('after', formatDataParams([
      ['documents[N][html]', 'HTML template with field tags'],
      ['documents[N][name]', 'Document name'],
    ]))
    .addHelpText('afterAll', formatExamples([
      'docuseal templates create-html --html "<p><text-field name=\"Name\"></text-field></p>" --name "Simple"',
      'docuseal templates create-html --file template.html --name "Contract"',
      'docuseal templates create-html -d "documents[0][html]=<p><text-field name=\"Name\"></text-field></p>" -d "documents[0][name]=Page 1"',
    ]))
    .action(async (opts) => {
      const body = {}
      if (opts.html !== undefined) body['html'] = opts.html
      if (opts.htmlHeader !== undefined) body['html_header'] = opts.htmlHeader
      if (opts.htmlFooter !== undefined) body['html_footer'] = opts.htmlFooter
      if (opts.name !== undefined) body['name'] = opts.name
      if (opts.size !== undefined) body['size'] = opts.size
      if (opts.externalId !== undefined) body['external_id'] = opts.externalId
      if (opts.folderName !== undefined) body['folder_name'] = opts.folderName
      if (opts.sharedLink !== undefined) body['shared_link'] = opts.sharedLink
      if (opts.file !== undefined) body.html = readFileSync(opts.file, 'utf8')
      if (opts.data.length > 0) deepMerge(body, parseDataFlags(opts.data))

      createClient(opts).createTemplateFromHtml(body).then(renderJson, onError)
    })

  withGlobalOptions(topic.command('clone'))
    .description('Clone a template')
    .argument('<id>', 'The id of the template')
    .addOption(new Option('--name <value>', 'Template name. Existing name with (Clone) suffix will be used if not specified.'))
    .addOption(new Option('--folder-name <value>', 'The folder\'s name to which the template should be cloned.'))
    .addOption(new Option('--external-id <value>', 'Your application-specific unique string key to identify this template within your app.'))
    .option('-d, --data <value>', 'Set body parameters using bracket notation', (val, prev) => prev.concat([val]), [])
    .addHelpText('afterAll', formatExamples([
      'docuseal templates clone 1001',
      'docuseal templates clone 1001 --name "NDA Copy"',
    ]))
    .action(async (id, opts) => {
      const body = {}
      if (opts.name !== undefined) body['name'] = opts.name
      if (opts.folderName !== undefined) body['folder_name'] = opts.folderName
      if (opts.externalId !== undefined) body['external_id'] = opts.externalId
      if (opts.data.length > 0) deepMerge(body, parseDataFlags(opts.data))

      createClient(opts).cloneTemplate(id, body).then(renderJson, onError)
    })

  withGlobalOptions(topic.command('merge'))
    .description('Merge templates (Pro)')
    .addOption(new Option('--name <value>', 'Template name. Existing name with (Merged) suffix will be used if not specified.'))
    .addOption(new Option('--folder-name <value>', 'The name of the folder in which the merged template should be placed.'))
    .addOption(new Option('--external-id <value>', 'Your application-specific unique string key to identify this template within your app.'))
    .option('--shared-link', 'Make the template available via a shared link.')
    .option('--no-shared-link', '')
    .option('-d, --data <value>', 'Set body parameters using bracket notation', (val, prev) => prev.concat([val]), [])
    .addHelpText('after', formatDataParams([
      ['template_ids[]', 'Template ID to merge (required)'],
      ['roles[]', 'Submitter role name'],
    ]))
    .addHelpText('afterAll', formatExamples([
      'docuseal templates merge -d "template_ids[]=1001" -d "template_ids[]=1002"',
      'docuseal templates merge -d "template_ids[]=1001" -d "template_ids[]=1002" --name "Combined"',
    ]))
    .action(async (opts) => {
      const body = {}
      if (opts.name !== undefined) body['name'] = opts.name
      if (opts.folderName !== undefined) body['folder_name'] = opts.folderName
      if (opts.externalId !== undefined) body['external_id'] = opts.externalId
      if (opts.sharedLink !== undefined) body['shared_link'] = opts.sharedLink
      if (opts.data.length > 0) deepMerge(body, parseDataFlags(opts.data))

      createClient(opts).mergeTemplates(body).then(renderJson, onError)
    })

  withGlobalOptions(topic.command('update-documents'))
    .description('Update template documents (Pro)')
    .argument('<id>', 'The id of the template')
    .option('--merge', 'Merge all existing and new documents into a single PDF.')
    .option('--no-merge', '')
    .option('-d, --data <value>', 'Set body parameters using bracket notation', (val, prev) => prev.concat([val]), [])
    .addHelpText('after', formatDataParams([
      ['documents[N][name]', 'Document name'],
      ['documents[N][file]', 'Base64-encoded PDF/DOCX or URL'],
      ['documents[N][html]', 'HTML template with field tags'],
      ['documents[N][position]', 'Position in template'],
      ['documents[N][replace]', 'Replace existing document (true/false)'],
      ['documents[N][remove]', 'Remove document (true/false)'],
    ]))
    .addHelpText('afterAll', formatExamples([
      'docuseal templates update-documents 1001',
      'docuseal templates update-documents 1001 -d "documents[0][file]=./contract.pdf"',
      'docuseal templates update-documents 1001 -d "documents[0][file]=https://example.com/doc.pdf"',
      'docuseal templates update-documents 1001 -d "documents[0][file]=https://example.com/doc.pdf" -d "documents[0][name]=New Doc"',
    ]))
    .action(async (id, opts) => {
      const body = {}
      if (opts.merge !== undefined) body['merge'] = opts.merge
      if (opts.data.length > 0) deepMerge(body, parseDataFlags(opts.data))

      createClient(opts).updateTemplateDocuments(id, body).then(renderJson, onError)
    })
}
