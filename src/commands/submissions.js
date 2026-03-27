import { Option } from 'commander'
import { readFileSync } from 'fs'
import { createClient, onError } from '../lib/api.js'
import { renderJson } from '../lib/output.js'
import { parseDataFlags, deepMerge } from '../lib/data-flags.js'
import { withGlobalOptions, formatDataParams, formatExamples } from '../lib/global-options.js'

export function registerSubmissionCommands(program) {
  const topic = program.command('submissions').description('Manage submissions')

  withGlobalOptions(topic.command('list'))
    .description('List all submissions')
    .addOption(new Option('--template-id <value>', 'The template ID allows you to receive only the submissions created from that specific template.').argParser(parseInt))
    .addOption(new Option('--status <value>', 'Filter submissions by status.').choices(['pending', 'completed', 'declined', 'expired']))
    .addOption(new Option('--q <value>', 'Filter submissions based on submitters name, email or phone partial match.'))
    .addOption(new Option('--slug <value>', 'Filter submissions by unique slug.'))
    .addOption(new Option('--template-folder <value>', 'Filter submissions by template folder name.'))
    .option('--archived', 'Filter by archived or active submissions.')
    .option('--no-archived', '')
    .addOption(new Option('-l, --limit <value>', 'The number of submissions to return. Default value is 10. Maximum value is 100.').argParser(parseInt))
    .addOption(new Option('-a, --after <value>', 'The unique identifier of the submission to start the list from. It allows you to receive only submissions with an ID greater than the specified value. Pass ID value from the `pagination.next` response to load the next batch of submissions.').argParser(parseInt))
    .addOption(new Option('--before <value>', 'The unique identifier of the submission that marks the end of the list. It allows you to receive only submissions with an ID less than the specified value.').argParser(parseInt))
    .option('-d, --data <value>', 'Set parameters using bracket notation', (val, prev) => prev.concat([val]), [])
    .addHelpText('afterAll', formatExamples([
      'docuseal submissions list',
      'docuseal submissions list --status pending',
      'docuseal submissions list --template-id 1001 --limit 50',
    ]))
    .action(async (opts) => {
      const query = {}
      if (opts.templateId !== undefined) query['template_id'] = opts.templateId
      if (opts.status !== undefined) query['status'] = opts.status
      if (opts.q !== undefined) query['q'] = opts.q
      if (opts.slug !== undefined) query['slug'] = opts.slug
      if (opts.templateFolder !== undefined) query['template_folder'] = opts.templateFolder
      if (opts.archived !== undefined) query['archived'] = opts.archived
      if (opts.limit !== undefined) query['limit'] = opts.limit
      if (opts.after !== undefined) query['after'] = opts.after
      if (opts.before !== undefined) query['before'] = opts.before
      if (opts.data.length > 0) Object.assign(query, parseDataFlags(opts.data))

      createClient(opts).listSubmissions(query).then(renderJson, onError)
    })

  withGlobalOptions(topic.command('retrieve'))
    .description('Get a submission')
    .argument('<id>', 'The id of the submission')
    .addHelpText('afterAll', formatExamples([
      'docuseal submissions retrieve 502',
    ]))
    .action(async (id, opts) => {
      createClient(opts).getSubmission(id).then(renderJson, onError)
    })

  withGlobalOptions(topic.command('archive'))
    .description('Archive a submission')
    .argument('<id>', 'The id of the submission')
    .addHelpText('afterAll', formatExamples([
      'docuseal submissions archive 502',
    ]))
    .action(async (id, opts) => {
      createClient(opts).archiveSubmission(id).then(renderJson, onError)
    })

  withGlobalOptions(topic.command('create'))
    .description('Create a submission')
    .addOption(new Option('--template-id <value>', 'The unique identifier of the template.').argParser(parseInt).makeOptionMandatory())
    .option('--send-email', 'Send signature request emails (enabled by default).')
    .option('--no-send-email', '')
    .option('--send-sms', 'Send signature request via SMS.')
    .option('--no-send-sms', '')
    .addOption(new Option('--order <value>', 'Pass \'random\' to send signature request emails to all parties right away. The order is \'preserved\' by default so the second party will receive a signature request email only after the document is signed by the first party.').choices(['preserved', 'random']))
    .addOption(new Option('--completed-redirect-url <value>', 'Specify URL to redirect to after the submission completion.'))
    .addOption(new Option('--bcc-completed <value>', 'Specify BCC address to send signed documents to after the completion.'))
    .addOption(new Option('--reply-to <value>', 'Specify Reply-To address to use in the notification emails.'))
    .addOption(new Option('--expire-at <value>', 'Specify the expiration date and time after which the submission becomes unavailable for signature.'))
    .option('-d, --data <value>', 'Set body parameters using bracket notation', (val, prev) => prev.concat([val]), [])
    .addHelpText('after', formatDataParams([
      ['submitters[N][email]', 'Email address (required)'],
      ['submitters[N][role]', 'Role name (e.g. "First Party")'],
      ['submitters[N][name]', 'Full name'],
      ['submitters[N][phone]', 'Phone (E.164, e.g. +1234567890)'],
      ['submitters[N][external_id]', 'App-specific ID'],
      ['submitters[N][completed]', 'Mark as completed (true/false)'],
      ['submitters[N][send_email]', 'Send email (true/false)'],
      ['submitters[N][send_sms]', 'Send SMS (true/false)'],
      ['submitters[N][values][fieldName]', 'Pre-filled field value'],
      ['submitters[N][reply_to]', 'Reply-To email'],
      ['submitters[N][completed_redirect_url]', 'Redirect URL after completion'],
      ['submitters[N][order]', 'Signing order (0, 1, 2...)'],
      ['submitters[N][require_phone_2fa]', 'Require phone 2FA (true/false)'],
      ['submitters[N][require_email_2fa]', 'Require email 2FA (true/false)'],
      ['submitters[N][metadata][key]', 'Submitter metadata'],
      ['submitters[N][message][subject]', 'Per-submitter email subject'],
      ['submitters[N][message][body]', 'Per-submitter email body'],
      ['submitters[N][roles][]', 'Merge multiple roles'],
      ['submitters[N][fields][M][name]', 'Field name (required)'],
      ['submitters[N][fields][M][default_value]', 'Default value'],
      ['submitters[N][fields][M][readonly]', 'Read-only (true/false)'],
      ['submitters[N][fields][M][required]', 'Required (true/false)'],
      ['submitters[N][fields][M][title]', 'Display title (Markdown)'],
      ['submitters[N][fields][M][description]', 'Display description (Markdown)'],
      ['message[subject]', 'Custom email subject'],
      ['message[body]', 'Custom email body'],
      ['variables[key]', 'Template variable'],
    ]))
    .addHelpText('afterAll', formatExamples([
      'docuseal submissions create --template-id 1001 -d "submitters[0][email]=john@acme.com"',
      'docuseal submissions create --template-id 1001 -d "submitters[0][email]=a@b.com" -d "submitters[1][email]=c@d.com"',
      'docuseal submissions create --template-id 1001 -d "submitters[0][email]=john@acme.com" -d "submitters[0][role]=Signer"',
      'docuseal submissions create --template-id 1001 -d "submitters[0][email]=john@acme.com" --no-send-email',
    ]))
    .action(async (opts) => {
      const body = {}
      if (opts.templateId !== undefined) body['template_id'] = opts.templateId
      if (opts.sendEmail !== undefined) body['send_email'] = opts.sendEmail
      if (opts.sendSms !== undefined) body['send_sms'] = opts.sendSms
      if (opts.order !== undefined) body['order'] = opts.order
      if (opts.completedRedirectUrl !== undefined) body['completed_redirect_url'] = opts.completedRedirectUrl
      if (opts.bccCompleted !== undefined) body['bcc_completed'] = opts.bccCompleted
      if (opts.replyTo !== undefined) body['reply_to'] = opts.replyTo
      if (opts.expireAt !== undefined) body['expire_at'] = opts.expireAt
      if (opts.data.length > 0) deepMerge(body, parseDataFlags(opts.data))

      createClient(opts).createSubmission(body).then(renderJson, onError)
    })

  withGlobalOptions(topic.command('send-emails'))
    .description('Create submissions from emails')
    .addOption(new Option('--template-id <value>', 'The unique identifier of the template.').argParser(parseInt).makeOptionMandatory())
    .addOption(new Option('--emails <value>', 'A comma-separated list of email addresses to send the submission to.').makeOptionMandatory())
    .option('--send-email', 'Send signature request emails (enabled by default).')
    .option('--no-send-email', '')
    .option('-d, --data <value>', 'Set body parameters using bracket notation', (val, prev) => prev.concat([val]), [])
    .addHelpText('after', formatDataParams([
      ['message[subject]', 'Custom email subject'],
      ['message[body]', 'Custom email body'],
    ]))
    .addHelpText('afterAll', formatExamples([
      'docuseal submissions send-emails --template-id 1001 --emails a@b.com,c@d.com',
      'docuseal submissions send-emails --template-id 1001 --emails a@b.com -d "message[subject]=Please sign" -d "message[body]=Hello"',
    ]))
    .action(async (opts) => {
      const body = {}
      if (opts.templateId !== undefined) body['template_id'] = opts.templateId
      if (opts.emails !== undefined) body['emails'] = opts.emails
      if (opts.sendEmail !== undefined) body['send_email'] = opts.sendEmail
      if (opts.data.length > 0) deepMerge(body, parseDataFlags(opts.data))

      createClient(opts).createSubmissionFromEmails(body).then(renderJson, onError)
    })

  withGlobalOptions(topic.command('create-pdf'))
    .description('Create a submission from PDF (Pro)')
    .addOption(new Option('--name <value>', 'Name of the document submission.'))
    .option('--send-email', 'Send signature request emails (enabled by default).')
    .option('--no-send-email', '')
    .option('--send-sms', 'Send signature request via SMS.')
    .option('--no-send-sms', '')
    .addOption(new Option('--order <value>', 'Pass \'random\' to send signature request emails to all parties right away. The order is \'preserved\' by default so the second party will receive a signature request email only after the document is signed by the first party.').choices(['preserved', 'random']))
    .addOption(new Option('--completed-redirect-url <value>', 'Specify URL to redirect to after the submission completion.'))
    .addOption(new Option('--bcc-completed <value>', 'Specify BCC address to send signed documents to after the completion.'))
    .addOption(new Option('--reply-to <value>', 'Specify Reply-To address to use in the notification emails.'))
    .addOption(new Option('--expire-at <value>', 'Specify the expiration date and time after which the submission becomes unavailable for signature.'))
    .option('--flatten', 'Remove PDF form fields from the documents.')
    .option('--no-flatten', '')
    .option('--merge-documents', 'Merge documents into a single PDF file.')
    .option('--no-merge-documents', '')
    .option('--remove-tags', 'Remove {{text}} tags from the PDF (enabled by default).')
    .option('--no-remove-tags', '')
    .addOption(new Option('--file <value>', 'Path to local PDF file').makeOptionMandatory())
    .option('-d, --data <value>', 'Set body parameters using bracket notation', (val, prev) => prev.concat([val]), [])
    .addHelpText('after', formatDataParams([
      ['submitters[N][email]', 'Email address (required)'],
      ['submitters[N][role]', 'Role name'],
      ['submitters[N][name]', 'Full name'],
      ['submitters[N][phone]', 'Phone (E.164)'],
      ['submitters[N][external_id]', 'App-specific ID'],
      ['submitters[N][completed]', 'Mark as completed (true/false)'],
      ['submitters[N][send_email]', 'Send email (true/false)'],
      ['submitters[N][send_sms]', 'Send SMS (true/false)'],
      ['submitters[N][values][fieldName]', 'Pre-filled field value'],
      ['submitters[N][metadata][key]', 'Submitter metadata'],
      ['submitters[N][fields][M][name]', 'Field name (required)'],
      ['submitters[N][fields][M][default_value]', 'Default value'],
      ['submitters[N][fields][M][readonly]', 'Read-only (true/false)'],
      ['submitters[N][fields][M][required]', 'Required (true/false)'],
      ['submitters[N][invite_by]', 'Role name of inviting party'],
      ['message[subject]', 'Custom email subject'],
      ['message[body]', 'Custom email body'],
    ]))
    .addHelpText('afterAll', formatExamples([
      'docuseal submissions create-pdf --file doc.pdf -d "submitters[0][email]=john@acme.com"',
    ]))
    .action(async (opts) => {
      const body = {}
      if (opts.name !== undefined) body['name'] = opts.name
      if (opts.sendEmail !== undefined) body['send_email'] = opts.sendEmail
      if (opts.sendSms !== undefined) body['send_sms'] = opts.sendSms
      if (opts.order !== undefined) body['order'] = opts.order
      if (opts.completedRedirectUrl !== undefined) body['completed_redirect_url'] = opts.completedRedirectUrl
      if (opts.bccCompleted !== undefined) body['bcc_completed'] = opts.bccCompleted
      if (opts.replyTo !== undefined) body['reply_to'] = opts.replyTo
      if (opts.expireAt !== undefined) body['expire_at'] = opts.expireAt
      if (opts.flatten !== undefined) body['flatten'] = opts.flatten
      if (opts.mergeDocuments !== undefined) body['merge_documents'] = opts.mergeDocuments
      if (opts.removeTags !== undefined) body['remove_tags'] = opts.removeTags
      if (opts.file !== undefined) {
        const fileContent = readFileSync(opts.file)
        const base64 = Buffer.from(fileContent).toString('base64')
        const fileName = opts.file.split('/').pop() || 'document'
        body.documents = [{ name: fileName, file: `data:application/octet-stream;base64,${base64}` }]
      }
      if (opts.data.length > 0) deepMerge(body, parseDataFlags(opts.data))

      createClient(opts).createSubmissionFromPdf(body).then(renderJson, onError)
    })

  withGlobalOptions(topic.command('create-docx'))
    .description('Create a submission from DOCX (Pro)')
    .addOption(new Option('--name <value>', 'Name of the document submission.'))
    .option('--send-email', 'Send signature request emails (enabled by default).')
    .option('--no-send-email', '')
    .option('--send-sms', 'Send signature request via SMS.')
    .option('--no-send-sms', '')
    .addOption(new Option('--order <value>', 'Pass \'random\' to send signature request emails to all parties right away. The order is \'preserved\' by default so the second party will receive a signature request email only after the document is signed by the first party.').choices(['preserved', 'random']))
    .addOption(new Option('--completed-redirect-url <value>', 'Specify URL to redirect to after the submission completion.'))
    .addOption(new Option('--bcc-completed <value>', 'Specify BCC address to send signed documents to after the completion.'))
    .addOption(new Option('--reply-to <value>', 'Specify Reply-To address to use in the notification emails.'))
    .addOption(new Option('--expire-at <value>', 'Specify the expiration date and time after which the submission becomes unavailable for signature.'))
    .option('--merge-documents', 'Merge documents into a single PDF file.')
    .option('--no-merge-documents', '')
    .option('--remove-tags', 'Remove {{text}} tags from the PDF (enabled by default).')
    .option('--no-remove-tags', '')
    .addOption(new Option('--file <value>', 'Path to local DOCX file').makeOptionMandatory())
    .option('-d, --data <value>', 'Set body parameters using bracket notation', (val, prev) => prev.concat([val]), [])
    .addHelpText('after', formatDataParams([
      ['submitters[N][email]', 'Email address (required)'],
      ['submitters[N][role]', 'Role name'],
      ['submitters[N][name]', 'Full name'],
      ['submitters[N][phone]', 'Phone (E.164)'],
      ['submitters[N][external_id]', 'App-specific ID'],
      ['submitters[N][completed]', 'Mark as completed (true/false)'],
      ['submitters[N][send_email]', 'Send email (true/false)'],
      ['submitters[N][send_sms]', 'Send SMS (true/false)'],
      ['submitters[N][values][fieldName]', 'Pre-filled field value'],
      ['submitters[N][metadata][key]', 'Submitter metadata'],
      ['submitters[N][fields][M][name]', 'Field name (required)'],
      ['submitters[N][fields][M][default_value]', 'Default value'],
      ['submitters[N][fields][M][readonly]', 'Read-only (true/false)'],
      ['submitters[N][fields][M][required]', 'Required (true/false)'],
      ['submitters[N][invite_by]', 'Role name of inviting party'],
      ['message[subject]', 'Custom email subject'],
      ['message[body]', 'Custom email body'],
      ['variables[key]', 'Template variable'],
    ]))
    .addHelpText('afterAll', formatExamples([
      'docuseal submissions create-docx --file doc.docx -d "submitters[0][email]=john@acme.com"',
    ]))
    .action(async (opts) => {
      const body = {}
      if (opts.name !== undefined) body['name'] = opts.name
      if (opts.sendEmail !== undefined) body['send_email'] = opts.sendEmail
      if (opts.sendSms !== undefined) body['send_sms'] = opts.sendSms
      if (opts.order !== undefined) body['order'] = opts.order
      if (opts.completedRedirectUrl !== undefined) body['completed_redirect_url'] = opts.completedRedirectUrl
      if (opts.bccCompleted !== undefined) body['bcc_completed'] = opts.bccCompleted
      if (opts.replyTo !== undefined) body['reply_to'] = opts.replyTo
      if (opts.expireAt !== undefined) body['expire_at'] = opts.expireAt
      if (opts.mergeDocuments !== undefined) body['merge_documents'] = opts.mergeDocuments
      if (opts.removeTags !== undefined) body['remove_tags'] = opts.removeTags
      if (opts.file !== undefined) {
        const fileContent = readFileSync(opts.file)
        const base64 = Buffer.from(fileContent).toString('base64')
        const fileName = opts.file.split('/').pop() || 'document'
        body.documents = [{ name: fileName, file: `data:application/octet-stream;base64,${base64}` }]
      }
      if (opts.data.length > 0) deepMerge(body, parseDataFlags(opts.data))

      createClient(opts).createSubmissionFromDocx(body).then(renderJson, onError)
    })

  withGlobalOptions(topic.command('create-html'))
    .description('Create a submission from HTML (Pro)')
    .addOption(new Option('--name <value>', 'Name of the document submission'))
    .option('--send-email', 'Send signature request emails (enabled by default).')
    .option('--no-send-email', '')
    .option('--send-sms', 'Send signature request via SMS.')
    .option('--no-send-sms', '')
    .addOption(new Option('--order <value>', 'Pass \'random\' to send signature request emails to all parties right away. The order is \'preserved\' by default so the second party will receive a signature request email only after the document is signed by the first party.').choices(['preserved', 'random']))
    .addOption(new Option('--completed-redirect-url <value>', 'Specify URL to redirect to after the submission completion.'))
    .addOption(new Option('--bcc-completed <value>', 'Specify BCC address to send signed documents to after the completion.'))
    .addOption(new Option('--reply-to <value>', 'Specify Reply-To address to use in the notification emails.'))
    .addOption(new Option('--expire-at <value>', 'Specify the expiration date and time after which the submission becomes unavailable for signature.'))
    .option('--merge-documents', 'Merge documents into a single PDF file.')
    .option('--no-merge-documents', '')
    .addOption(new Option('--html-file <value>', 'Path to local HTML file'))
    .option('-d, --data <value>', 'Set body parameters using bracket notation', (val, prev) => prev.concat([val]), [])
    .addHelpText('after', formatDataParams([
      ['submitters[N][email]', 'Email address (required)'],
      ['submitters[N][role]', 'Role name'],
      ['submitters[N][name]', 'Full name'],
      ['submitters[N][phone]', 'Phone (E.164)'],
      ['submitters[N][external_id]', 'App-specific ID'],
      ['submitters[N][completed]', 'Mark as completed (true/false)'],
      ['submitters[N][send_email]', 'Send email (true/false)'],
      ['submitters[N][send_sms]', 'Send SMS (true/false)'],
      ['submitters[N][values][fieldName]', 'Pre-filled field value'],
      ['submitters[N][metadata][key]', 'Submitter metadata'],
      ['submitters[N][fields][M][name]', 'Field name (required)'],
      ['submitters[N][fields][M][default_value]', 'Default value'],
      ['submitters[N][fields][M][readonly]', 'Read-only (true/false)'],
      ['submitters[N][fields][M][required]', 'Required (true/false)'],
      ['submitters[N][invite_by]', 'Role name of inviting party'],
      ['documents[N][html]', 'HTML template with field tags'],
      ['documents[N][name]', 'Document name'],
      ['documents[N][size]', 'Page size (Letter, A4, ...)'],
      ['message[subject]', 'Custom email subject'],
      ['message[body]', 'Custom email body'],
    ]))
    .addHelpText('afterAll', formatExamples([
      'docuseal submissions create-html --html-file template.html -d "submitters[0][email]=john@acme.com"',
      'docuseal submissions create-html -d "documents[0][html]=<p>{{name}}</p>" -d "submitters[0][email]=john@acme.com"',
    ]))
    .action(async (opts) => {
      const body = {}
      if (opts.name !== undefined) body['name'] = opts.name
      if (opts.sendEmail !== undefined) body['send_email'] = opts.sendEmail
      if (opts.sendSms !== undefined) body['send_sms'] = opts.sendSms
      if (opts.order !== undefined) body['order'] = opts.order
      if (opts.completedRedirectUrl !== undefined) body['completed_redirect_url'] = opts.completedRedirectUrl
      if (opts.bccCompleted !== undefined) body['bcc_completed'] = opts.bccCompleted
      if (opts.replyTo !== undefined) body['reply_to'] = opts.replyTo
      if (opts.expireAt !== undefined) body['expire_at'] = opts.expireAt
      if (opts.mergeDocuments !== undefined) body['merge_documents'] = opts.mergeDocuments
      if (opts.htmlFile !== undefined) body.html = readFileSync(opts.htmlFile, 'utf8')
      if (opts.data.length > 0) deepMerge(body, parseDataFlags(opts.data))

      createClient(opts).createSubmissionFromHtml(body).then(renderJson, onError)
    })

  withGlobalOptions(topic.command('documents'))
    .description('Get submission documents')
    .argument('<id>', 'The id of the submission')
    .option('--merge', 'Merge all documents into a single PDF.')
    .option('--no-merge', '')
    .option('-d, --data <value>', 'Set parameters using bracket notation', (val, prev) => prev.concat([val]), [])
    .addHelpText('afterAll', formatExamples([
      'docuseal submissions documents 502',
      'docuseal submissions documents 502 --merge',
    ]))
    .action(async (id, opts) => {
      const query = {}
      if (opts.merge !== undefined) query['merge'] = opts.merge
      if (opts.data.length > 0) Object.assign(query, parseDataFlags(opts.data))

      createClient(opts).getSubmissionDocuments(id, query).then(renderJson, onError)
    })
}
