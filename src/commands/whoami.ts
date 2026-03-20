import { type Command } from 'commander'
import { apiFetch } from '../lib/api.ts'
import { loadConfig } from '../lib/config.ts'
import { renderSuccess, renderError } from '../lib/output.ts'

export function registerWhoAmI(program: Command): void {
  program
    .command('whoami')
    .description('Verify authentication')
    .option('--api-key <value>', 'Override API key for this invocation')
    .option('--server <value>', 'Server: com, eu, or full URL')
    .addHelpText('after', '\nExamples:\n  $ docuseal whoami')
    .action(async (opts) => {
      const configOverrides: any = {}
      if (opts.apiKey) configOverrides.apiKey = opts.apiKey
      if (opts.server) configOverrides.server = opts.server

      try {
        const config = loadConfig(Object.keys(configOverrides).length > 0 ? configOverrides : undefined)
        await apiFetch('/submissions', {
          query: { limit: 1 },
          configOverrides: Object.keys(configOverrides).length > 0 ? configOverrides : undefined,
        })
        renderSuccess('Authenticated', { server: config.server })
      } catch {
        renderError('Authentication failed')
        process.exit(1)
      }
    })
}
