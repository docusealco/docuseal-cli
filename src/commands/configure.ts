import { Command, Flags } from '@oclif/core'
import { createInterface } from 'readline'
import { apiFetch } from '../lib/api.ts'
import { saveConfig, resolveServer } from '../lib/config.ts'
import { renderSuccess, renderError } from '../lib/output.ts'

export default class Configure extends Command {
  static id = 'configure'
  static description = 'Configure API key and server'

  static examples = [
    'docuseal configure',
    'docuseal configure --api-key YOUR_KEY --server com',
  ]

  static flags = {
    'api-key': Flags.string({
      description: 'API key to save',
    }),
    server: Flags.string({
      description: 'Server: com, eu, or full URL (default: com)',
    }),
  }

  async run() {
    const { flags } = await this.parse(Configure)

    let apiKey = flags['api-key']
    let server = flags.server

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
  }
}
