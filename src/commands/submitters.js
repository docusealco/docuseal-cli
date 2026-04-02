import { Option } from 'commander'
import { createClient, onError } from '../lib/api.js'
import { renderJson } from '../lib/output.js'
import { parseDataFlags, deepMerge } from '../lib/data-flags.js'
import { withGlobalOptions, formatDataParams, formatExamples } from '../lib/global-options.js'

export function registerSubmitterCommands(program) {
  const topic = program.command('submitters').description('Manage submitters')

  withGlobalOptions(topic.command('list'))
    .description('List all submitters')
    .addOption(new Option('--submission-id <value>', 'The submission ID allows you to receive only the submitters related to that specific submission.').argParser(parseInt))
    .addOption(new Option('--q <value>', 'Filter submitters on name, email or phone partial match.'))
    .addOption(new Option('--slug <value>', 'Filter submitters by unique slug.'))
    .addOption(new Option('--completed-after <value>', 'The date and time string value to filter submitters that completed the submission after the specified date and time.'))
    .addOption(new Option('--completed-before <value>', 'The date and time string value to filter submitters that completed the submission before the specified date and time.'))
    .addOption(new Option('--external-id <value>', 'The unique applications-specific identifier provided for a submitter when initializing a signature request. It allows you to receive only submitters with a specified external id.'))
    .addOption(new Option('-l, --limit <value>', 'The number of submitters to return. Default value is 10. Maximum value is 100.').argParser(parseInt))
    .addOption(new Option('-a, --after <value>', 'The unique identifier of the submitter to start the list from. It allows you to receive only submitters with id greater than the specified value. Pass ID value from the `pagination.next` response to load the next batch of submitters.').argParser(parseInt))
    .addOption(new Option('--before <value>', 'The unique identifier of the submitter to end the list with. It allows you to receive only submitters with id less than the specified value.').argParser(parseInt))
    .option('-d, --data <value>', 'Set parameters using bracket notation or JSON', (val, prev) => prev.concat([val]), [])
    .addHelpText('afterAll', formatExamples([
      'docuseal submitters list',
      'docuseal submitters list --submission-id 502',
    ]))
    .action(async (opts) => {
      const query = {}
      if (opts.submissionId !== undefined) query['submission_id'] = opts.submissionId
      if (opts.q !== undefined) query['q'] = opts.q
      if (opts.slug !== undefined) query['slug'] = opts.slug
      if (opts.completedAfter !== undefined) query['completed_after'] = opts.completedAfter
      if (opts.completedBefore !== undefined) query['completed_before'] = opts.completedBefore
      if (opts.externalId !== undefined) query['external_id'] = opts.externalId
      if (opts.limit !== undefined) query['limit'] = opts.limit
      if (opts.after !== undefined) query['after'] = opts.after
      if (opts.before !== undefined) query['before'] = opts.before
      if (opts.data.length > 0) Object.assign(query, parseDataFlags(opts.data))

      createClient(opts).listSubmitters(query).then(renderJson, onError)
    })

  withGlobalOptions(topic.command('retrieve'))
    .description('Get a submitter')
    .argument('<id>', 'The id of the submitter')
    .addHelpText('afterAll', formatExamples([
      'docuseal submitters retrieve 201',
    ]))
    .action(async (id, opts) => {
      createClient(opts).getSubmitter(id).then(renderJson, onError)
    })

  withGlobalOptions(topic.command('update'))
    .description('Update a submitter')
    .argument('<id>', 'The id of the submitter')
    .addOption(new Option('--name <value>', 'The name of the submitter.'))
    .addOption(new Option('--email <value>', 'The email address of the submitter.'))
    .addOption(new Option('--phone <value>', 'The phone number of the submitter, formatted according to the E.164 standard.'))
    .addOption(new Option('--external-id <value>', 'Your application-specific unique string key to identify this submitter within your app.'))
    .option('--send-email', 'Re-send signature request emails.')
    .option('--send-sms', 'Re-send signature request via SMS.')
    .addOption(new Option('--reply-to <value>', 'Specify Reply-To address to use in the notification emails.'))
    .option('--completed', 'Mark submitter as completed and auto-signed.')
    .addOption(new Option('--completed-redirect-url <value>', 'Submitter specific URL to redirect to after the submission completion.'))
    .option('--require-phone-2fa', 'Require phone 2FA verification via one-time code.')
    .option('--require-email-2fa', 'Require email 2FA verification via one-time code.')
    .option('-d, --data <value>', 'Set body parameters using bracket notation or JSON', (val, prev) => prev.concat([val]), [])
    .addHelpText('after', formatDataParams([
      ['values[fieldName]', 'Pre-filled field value'],
      ['metadata[key]', 'Submitter metadata'],
      ['message[subject]', 'Custom email subject'],
      ['message[body]', 'Custom email body'],
      ['fields[N][name]', 'Field name (required)'],
      ['fields[N][default_value]', 'Default value'],
      ['fields[N][readonly]', 'Read-only (true/false)'],
      ['fields[N][required]', 'Required (true/false)']
    ]))
    .addHelpText('afterAll', formatExamples([
      'docuseal submitters update 201 --email new@acme.com',
      'docuseal submitters update 201 --completed',
      'docuseal submitters update 201 -d "values[First Name]=John" -d "metadata[department]=Sales"',
    ]))
    .action(async (id, opts) => {
      const body = {}
      if (opts.name !== undefined) body['name'] = opts.name
      if (opts.email !== undefined) body['email'] = opts.email
      if (opts.phone !== undefined) body['phone'] = opts.phone
      if (opts.externalId !== undefined) body['external_id'] = opts.externalId
      if (opts.sendEmail) body['send_email'] = true
      if (opts.sendSms) body['send_sms'] = true
      if (opts.replyTo !== undefined) body['reply_to'] = opts.replyTo
      if (opts.completed) body['completed'] = true
      if (opts.completedRedirectUrl !== undefined) body['completed_redirect_url'] = opts.completedRedirectUrl
      if (opts.requirePhone2fa) body['require_phone_2fa'] = true
      if (opts.requireEmail2fa) body['require_email_2fa'] = true
      if (opts.data.length > 0) deepMerge(body, parseDataFlags(opts.data))

      createClient(opts).updateSubmitter(id, body).then(renderJson, onError)
    })
}
