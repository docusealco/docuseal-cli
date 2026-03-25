import { apiFetch } from '../lib/api.js'
import { DocuSealError } from '../lib/errors.js'
import { renderJson } from '../lib/output.js'

function parseDataFlags(pairs) {
  const result = {}
  for (const pair of pairs) {
    const eqIdx = pair.indexOf('=')
    if (eqIdx === -1) continue
    result[pair.slice(0, eqIdx)] = pair.slice(eqIdx + 1)
  }
  return result
}

function registerRawCommand(program, name, method) {
  program
    .command(name)
    .description(`Make a raw ${method} request to the API`)
    .argument('<path>', 'API path (e.g. /templates, /submissions/1)')
    .option('--api-key <value>', 'Override API key for this invocation')
    .option('--server <value>', 'Server: com, eu, or full URL')
    .option('-d, --data <value>', 'Set body parameters (e.g. -d "name=NDA")', (val, prev) => prev.concat([val]), [])
    .addHelpText('after', `\nExamples:\n  $ docuseal ${name} /templates\n  $ docuseal ${name} /templates/1`)
    .action(async (path, opts) => {
      const configOverrides = {}
      if (opts.apiKey) configOverrides.apiKey = opts.apiKey
      if (opts.server) configOverrides.server = opts.server

      const dataFlags = opts.data
      const body = dataFlags.length > 0 ? parseDataFlags(dataFlags) : undefined

      try {
        const result = await apiFetch(path, {
          method,
          body,
          configOverrides: Object.keys(configOverrides).length > 0 ? configOverrides : undefined,
        })
        renderJson(result)
      } catch (err) {
        if (err instanceof DocuSealError) {
          if (err.body) {
            renderJson(err.body)
          } else {
            renderJson({ error: err.message, status: err.status })
          }
          process.exit(1)
        }
        throw err
      }
    })
}

export function registerRawCommands(program) {
  registerRawCommand(program, 'get', 'GET')
  registerRawCommand(program, 'post', 'POST')
  registerRawCommand(program, 'put', 'PUT')
  registerRawCommand(program, 'delete', 'DELETE')
}
