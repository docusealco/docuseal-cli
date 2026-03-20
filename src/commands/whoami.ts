import { Command, Flags } from '@oclif/core'
import { apiFetch } from '../lib/api.ts'
import { loadConfig } from '../lib/config.ts'
import { renderSuccess, renderError } from '../lib/output.ts'

export default class WhoAmI extends Command {
  static id = 'whoami'
  static description = 'Verify authentication'

  static examples = [
    'docuseal whoami',
  ]

  static flags = {
    'api-key': Flags.string({
      description: 'Override API key for this invocation',
    }),
    server: Flags.string({
      description: 'Server: com, eu, or full URL',
    }),
  }

  async run() {
    const { flags } = await this.parse(WhoAmI)

    const configOverrides: any = {}
    if (flags['api-key']) configOverrides.apiKey = flags['api-key']
    if (flags.server) configOverrides.server = flags.server

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
  }
}
