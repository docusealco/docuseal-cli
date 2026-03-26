import { createInterface } from 'readline'
import { DocusealApi } from '@docuseal/api'
import { loadConfig, saveConfig, resolveServer } from '../lib/config.js'
import { renderSuccess, renderError } from '../lib/output.js'
import { formatExamples } from '../lib/global-options.js'

export function registerConfigure(program) {
  program
    .command('configure')
    .description('Configure API key and server')
    .option('--api-key <value>', 'API key to save')
    .option('--server <value>', 'Server: com, eu, or full URL (default: com)')
    .option('--list', 'Show current configuration and verify authentication')
    .addHelpText('afterAll', formatExamples([
      'docuseal configure',
      'docuseal configure --api-key YOUR_KEY --server com',
      'docuseal configure --list',
    ]))
    .action(async (opts) => {
      if (opts.list) {
        try {
          const config = loadConfig()
          const masked = config.apiKey.slice(0, 8) + '...' + config.apiKey.slice(-4)
          console.log(`api_key: ${masked}`)
          console.log(`server: ${config.server}`)
        } catch (err) {
          renderError(err.message)
          process.exit(1)
        }
        return
      }

      let apiKey = opts.apiKey
      let server = opts.server

      if (!apiKey || !server) {
        const rl = createInterface({ input: process.stdin, output: process.stdout })

        const ask = (q) =>
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
        const client = new DocusealApi({ key: apiKey, url: resolvedServer })
        await client.listSubmissions({ limit: 1 })
      } catch {
        renderError('Invalid API key')
        process.exit(1)
      }

      saveConfig({ apiKey, server: resolvedServer })
      renderSuccess('Saved to ~/.docuseal/config.yml')
    })
}
