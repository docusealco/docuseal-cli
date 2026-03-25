import { Option } from 'commander'
import { apiFetch } from '../lib/api.js'
import { DocuSealError } from '../lib/errors.js'
import { renderJson } from '../lib/output.js'
import { parseDataFlags, deepMerge } from '../lib/data-flags.js'

export function registerSubmitterCommands(program) {
  const topic = program.command('submitters').description('Manage submitters')

  topic
    .command('list')
    .description('List all submitters')
    .option('--api-key <value>', 'Override API key for this invocation')
    .option('--server <value>', 'Server: com, eu, or full URL')
    .option('-d, --data <value>', 'Set body parameters using bracket notation (e.g. -d "submitters[0][email]=john@acme.com")', (val, prev) => prev.concat([val]), [])
    .addOption(new Option('--submission-id <value>', 'The submission ID allows you to receive only the submitters related to that specific submission.').argParser(parseInt))
    .addOption(new Option('--q <value>', 'Filter submitters on name, email or phone partial match.'))
    .addOption(new Option('--slug <value>', 'Filter submitters by unique slug.'))
    .addOption(new Option('--completed-after <value>', 'The date and time string value to filter submitters that completed the submission after the specified date and time.'))
    .addOption(new Option('--completed-before <value>', 'The date and time string value to filter submitters that completed the submission before the specified date and time.'))
    .addOption(new Option('--external-id <value>', 'The unique applications-specific identifier provided for a submitter when initializing a signature request. It allows you to receive only submitters with a specified external id.'))
    .addOption(new Option('-l, --limit <value>', 'The number of submitters to return. Default value is 10. Maximum value is 100.').argParser(parseInt))
    .addOption(new Option('-a, --after <value>', 'The unique identifier of the submitter to start the list from. It allows you to receive only submitters with id greater than the specified value. Pass ID value from the `pagination.next` response to load the next batch of submitters.').argParser(parseInt))
    .addOption(new Option('--before <value>', 'The unique identifier of the submitter to end the list with. It allows you to receive only submitters with id less than the specified value.').argParser(parseInt))
    .addHelpText('after', '\nExamples:\n  $ docuseal submitters list\n  $ docuseal submitters list --submission-id 502')
    .action(async (opts) => {
      const configOverrides = {}
      if (opts.apiKey) configOverrides.apiKey = opts.apiKey
      if (opts.server) configOverrides.server = opts.server

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

      const body = {}
      let hasBody = false
      if (opts.data.length > 0) { hasBody = true; deepMerge(body, parseDataFlags(opts.data)) }

      try {
        const result = await apiFetch('/submitters', {
          method: 'GET',
          query: Object.keys(query).length > 0 ? query : undefined,
          body: hasBody ? body : undefined,
          configOverrides: Object.keys(configOverrides).length > 0 ? configOverrides : undefined,
        })
        renderJson(result)
      } catch (err) {
        if (err instanceof DocuSealError) {
          renderJson(err.body || { error: err.message, status: err.status })
          process.exit(1)
        }
        throw err
      }
    })

  topic
    .command('retrieve')
    .description('Get a submitter')
    .argument('<id>', 'The id of the resource')
    .option('--api-key <value>', 'Override API key for this invocation')
    .option('--server <value>', 'Server: com, eu, or full URL')
    .option('-d, --data <value>', 'Set body parameters using bracket notation (e.g. -d "submitters[0][email]=john@acme.com")', (val, prev) => prev.concat([val]), [])
    .addHelpText('after', '\nExamples:\n  $ docuseal submitters retrieve 201')
    .action(async (id, opts) => {
      const configOverrides = {}
      if (opts.apiKey) configOverrides.apiKey = opts.apiKey
      if (opts.server) configOverrides.server = opts.server

      const body = {}
      let hasBody = false
      if (opts.data.length > 0) { hasBody = true; deepMerge(body, parseDataFlags(opts.data)) }

      try {
        const result = await apiFetch(`/submitters/${id}`, {
          method: 'GET',
          body: hasBody ? body : undefined,
          configOverrides: Object.keys(configOverrides).length > 0 ? configOverrides : undefined,
        })
        renderJson(result)
      } catch (err) {
        if (err instanceof DocuSealError) {
          renderJson(err.body || { error: err.message, status: err.status })
          process.exit(1)
        }
        throw err
      }
    })

  topic
    .command('update')
    .description('Update a submitter')
    .argument('<id>', 'The id of the resource')
    .option('--api-key <value>', 'Override API key for this invocation')
    .option('--server <value>', 'Server: com, eu, or full URL')
    .option('-d, --data <value>', 'Set body parameters using bracket notation (e.g. -d "submitters[0][email]=john@acme.com")', (val, prev) => prev.concat([val]), [])
    .addOption(new Option('--name <value>', 'The name of the submitter.'))
    .addOption(new Option('--email <value>', 'The email address of the submitter.'))
    .addOption(new Option('--phone <value>', 'The phone number of the submitter, formatted according to the E.164 standard.'))
    .addOption(new Option('--external-id <value>', 'Your application-specific unique string key to identify this submitter within your app.'))
    .option('--send-email', 'Set `true` to re-send signature request emails.')
    .option('--no-send-email', '')
    .option('--send-sms', 'Set `true` to re-send signature request via phone number SMS.')
    .option('--no-send-sms', '')
    .addOption(new Option('--reply-to <value>', 'Specify Reply-To address to use in the notification emails.'))
    .option('--completed', 'Pass `true` to mark submitter as completed and auto-signed via API.')
    .option('--no-completed', '')
    .addOption(new Option('--completed-redirect-url <value>', 'Submitter specific URL to redirect to after the submission completion.'))
    .option('--require-phone-2fa', 'Set to `true` to require phone 2FA verification via a one-time code sent to the phone number in order to access the documents.')
    .option('--no-require-phone-2fa', '')
    .option('--require-email-2fa', 'Set to `true` to require email 2FA verification via a one-time code sent to the email address in order to access the documents.')
    .option('--no-require-email-2fa', '')
    .addHelpText('after', '\nExamples:\n  $ docuseal submitters update 201 --email new@acme.com\n  $ docuseal submitters update 201 --completed')
    .action(async (id, opts) => {
      const configOverrides = {}
      if (opts.apiKey) configOverrides.apiKey = opts.apiKey
      if (opts.server) configOverrides.server = opts.server

      const body = {}
      let hasBody = false
      if (opts.name !== undefined) { hasBody = true; body['name'] = opts.name }
      if (opts.email !== undefined) { hasBody = true; body['email'] = opts.email }
      if (opts.phone !== undefined) { hasBody = true; body['phone'] = opts.phone }
      if (opts.externalId !== undefined) { hasBody = true; body['external_id'] = opts.externalId }
      if (opts.sendEmail !== undefined) { hasBody = true; body['send_email'] = opts.sendEmail }
      if (opts.sendSms !== undefined) { hasBody = true; body['send_sms'] = opts.sendSms }
      if (opts.replyTo !== undefined) { hasBody = true; body['reply_to'] = opts.replyTo }
      if (opts.completed !== undefined) { hasBody = true; body['completed'] = opts.completed }
      if (opts.completedRedirectUrl !== undefined) { hasBody = true; body['completed_redirect_url'] = opts.completedRedirectUrl }
      if (opts.requirePhone2fa !== undefined) { hasBody = true; body['require_phone_2fa'] = opts.requirePhone2fa }
      if (opts.requireEmail2fa !== undefined) { hasBody = true; body['require_email_2fa'] = opts.requireEmail2fa }
      if (opts.data.length > 0) { hasBody = true; deepMerge(body, parseDataFlags(opts.data)) }

      try {
        const result = await apiFetch(`/submitters/${id}`, {
          method: 'PUT',
          body: hasBody ? body : undefined,
          configOverrides: Object.keys(configOverrides).length > 0 ? configOverrides : undefined,
        })
        renderJson(result)
      } catch (err) {
        if (err instanceof DocuSealError) {
          renderJson(err.body || { error: err.message, status: err.status })
          process.exit(1)
        }
        throw err
      }
    })
}
