import { Option } from 'commander'
import { readFileSync } from 'fs'
import { createClient, onError } from '../lib/api.js'
import { renderJson } from '../lib/output.js'
import { parseDataFlags, deepMerge } from '../lib/data-flags.js'
import { withGlobalOptions } from '../lib/global-options.js'

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
    .addHelpText('afterAll', '\nExamples:\n  $ docuseal templates list\n  $ docuseal templates list --folder Legal --limit 50\n  $ docuseal templates list --archived\n  $ docuseal templates list | jq \'.data[].id\'')
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

      createClient(opts).listTemplates(query).then(renderJson, onError)
    })

  withGlobalOptions(topic.command('retrieve'))
    .description('Get a template')
    .argument('<id>', 'The id of the resource')
    .addHelpText('afterAll', '\nExamples:\n  $ docuseal templates retrieve 1001')
    .action(async (id, opts) => {
      createClient(opts).getTemplate(id).then(renderJson, onError)
    })

  withGlobalOptions(topic.command('update'))
    .description('Update a template')
    .argument('<id>', 'The id of the resource')
    .addOption(new Option('--name <value>', 'The name of the template'))
    .addOption(new Option('--folder-name <value>', 'The folder\'s name to which the template should be moved.'))
    .option('-d, --data <value>', 'Set body parameters using bracket notation (e.g. -d "roles[]=Signer")', (val, prev) => prev.concat([val]), [])
    .option('--archived', 'Archive or unarchive the template.')
    .option('--no-archived', '')
    .addHelpText('afterAll', '\nExamples:\n  $ docuseal templates update 1001 --name "NDA v2"\n  $ docuseal templates update 1001 --folder-name Contracts\n  $ docuseal templates update 1001 -d "roles[]=Signer" -d "roles[]=Reviewer"\n  $ docuseal templates update 1001 --no-archived')
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
    .argument('<id>', 'The id of the resource')
    .addHelpText('afterAll', '\nExamples:\n  $ docuseal templates archive 1001')
    .action(async (id, opts) => {
      createClient(opts).archiveTemplate(id).then(renderJson, onError)
    })

  withGlobalOptions(topic.command('create-pdf'))
    .description('Create a template from PDF (Pro)')
    .option('-d, --data <value>', 'Set body parameters using bracket notation (e.g. -d "submitters[0][email]=john@acme.com")', (val, prev) => prev.concat([val]), [])
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
    .addHelpText('afterAll', '\nExamples:\n  $ docuseal templates create-pdf --file contract.pdf --name "NDA"\n  $ docuseal templates create-pdf --file form.pdf --folder-name Legal')
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
    .option('-d, --data <value>', 'Set body parameters using bracket notation (e.g. -d "submitters[0][email]=john@acme.com")', (val, prev) => prev.concat([val]), [])
    .addOption(new Option('--name <value>', 'Name of the template'))
    .addOption(new Option('--external-id <value>', 'Your application-specific unique string key to identify this template within your app. Existing template with specified `external_id` will be updated with a new document.'))
    .addOption(new Option('--folder-name <value>', 'The folder\'s name in which the template should be created.'))
    .option('--shared-link', 'Make the template available via a shared link.')
    .option('--no-shared-link', '')
    .addOption(new Option('--file <value>', 'Path to local DOCX file').makeOptionMandatory())
    .addHelpText('afterAll', '\nExamples:\n  $ docuseal templates create-docx --file template.docx --name "Contract"')
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
    .option('-d, --data <value>', 'Set body parameters using bracket notation (e.g. -d "submitters[0][email]=john@acme.com")', (val, prev) => prev.concat([val]), [])
    .addOption(new Option('--html <value>', 'HTML template with field tags.'))
    .addOption(new Option('--html-header <value>', 'HTML template of the header to be displayed on every page.'))
    .addOption(new Option('--html-footer <value>', 'HTML template of the footer to be displayed on every page.'))
    .addOption(new Option('--name <value>', 'Template name. Random uuid will be assigned when not specified.'))
    .addOption(new Option('--size <value>', 'Page size. Letter 8.5 x 11 will be assigned when not specified.').choices(['Letter', 'Legal', 'Tabloid', 'Ledger', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6']))
    .addOption(new Option('--external-id <value>', 'Your application-specific unique string key to identify this template within your app. Existing template with specified `external_id` will be updated with a new HTML.'))
    .addOption(new Option('--folder-name <value>', 'The folder\'s name in which the template should be created.'))
    .option('--shared-link', 'Make the template available via a shared link.')
    .option('--no-shared-link', '')
    .addOption(new Option('--html-file <value>', 'Path to local HTML file (alternative to --html)'))
    .addHelpText('afterAll', '\nExamples:\n  $ docuseal templates create-html --html "<p>{{name}}</p>" --name "Simple"\n  $ docuseal templates create-html --html-file template.html --name "Contract"')
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
      if (opts.htmlFile !== undefined) body.html = readFileSync(opts.htmlFile, 'utf8')
      if (opts.data.length > 0) deepMerge(body, parseDataFlags(opts.data))

      createClient(opts).createTemplateFromHtml(body).then(renderJson, onError)
    })

  withGlobalOptions(topic.command('clone'))
    .description('Clone a template')
    .argument('<id>', 'The id of the resource')
    .addOption(new Option('--name <value>', 'Template name. Existing name with (Clone) suffix will be used if not specified.'))
    .addOption(new Option('--folder-name <value>', 'The folder\'s name to which the template should be cloned.'))
    .addOption(new Option('--external-id <value>', 'Your application-specific unique string key to identify this template within your app.'))
    .addHelpText('afterAll', '\nExamples:\n  $ docuseal templates clone 1001\n  $ docuseal templates clone 1001 --name "NDA Copy"')
    .action(async (id, opts) => {
      const body = {}
      if (opts.name !== undefined) body['name'] = opts.name
      if (opts.folderName !== undefined) body['folder_name'] = opts.folderName
      if (opts.externalId !== undefined) body['external_id'] = opts.externalId

      createClient(opts).cloneTemplate(id, body).then(renderJson, onError)
    })

  withGlobalOptions(topic.command('merge'))
    .description('Merge templates (Pro)')
    .option('-d, --data <value>', 'Set body parameters using bracket notation (e.g. -d "template_ids[]=1001")', (val, prev) => prev.concat([val]), [])
    .addOption(new Option('--name <value>', 'Template name. Existing name with (Merged) suffix will be used if not specified.'))
    .addOption(new Option('--folder-name <value>', 'The name of the folder in which the merged template should be placed.'))
    .addOption(new Option('--external-id <value>', 'Your application-specific unique string key to identify this template within your app.'))
    .option('--shared-link', 'Make the template available via a shared link.')
    .option('--no-shared-link', '')
    .addHelpText('afterAll', '\nExamples:\n  $ docuseal templates merge -d "template_ids[]=1001" -d "template_ids[]=1002"\n  $ docuseal templates merge -d "template_ids[]=1001" -d "template_ids[]=1002" --name "Combined"')
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
    .argument('<id>', 'The id of the resource')
    .option('-d, --data <value>', 'Set body parameters using bracket notation (e.g. -d "documents[0][file]=url")', (val, prev) => prev.concat([val]), [])
    .option('--merge', 'Merge all existing and new documents into a single PDF.')
    .option('--no-merge', '')
    .addHelpText('afterAll', '\nExamples:\n  $ docuseal templates update-documents 1001')
    .action(async (id, opts) => {
      const body = {}
      if (opts.merge !== undefined) body['merge'] = opts.merge
      if (opts.data.length > 0) deepMerge(body, parseDataFlags(opts.data))

      createClient(opts).updateTemplateDocuments(id, body).then(renderJson, onError)
    })
}
