import { type Command } from 'commander'
import { createInterface } from 'readline'
import { apiFetch } from '../lib/api.ts'
import { saveConfig, resolveServer } from '../lib/config.ts'
import { renderSuccess, renderError } from '../lib/output.ts'

export function registerConfigure(program: Command): void {
  program
    .command('configure')
    .description('Configure API key and server')
    .option('--api-key <value>', 'API key to save')
    .option('--server <value>', 'Server: com, eu, or full URL (default: com)')
    .addHelpText('after', '\nExamples:\n  $ docuseal configure\n  $ docuseal configure --api-key YOUR_KEY --server com')
    .action(async (opts) => {
      let apiKey = opts.apiKey
      let server = opts.server

      if (!apiKey || !server) {
        const rl = createInterface({ input: process.stdin, output: process.stdout })

        const ask = (q: string): Promise<string> =>
          new Promise(resolve => rl.question(q, resolve))

        if (!server) {
          server = (await ask('Server [com/eu/url] (default: com): ')) || 'com'
        }
        if (!apiKey) {
          apiKey = await ask('Enter your API token: ')
        }

        rl.close()
      }

      const resolvedServer = resolveServer(server)

      try {
        await apiFetch('/submissions', {
          query: { limit: 1 },
          configOverrides: { apiKey, server: resolvedServer },
        })
      } catch {
        renderError('Invalid API key')
        process.exit(1)
      }

      saveConfig({ apiKey, server: resolvedServer })
      renderSuccess('Saved to ~/.docuseal/config.yml')
    })
}
