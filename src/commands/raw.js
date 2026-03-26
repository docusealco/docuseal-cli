import { createClient, onError } from '../lib/api.js'
import { renderJson } from '../lib/output.js'
import { withGlobalOptions } from '../lib/global-options.js'

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
  withGlobalOptions(program.command(name))
    .description(`Make a raw ${method} request to the API`)
    .argument('<path>', 'API path (e.g. /templates, /submissions/1)')
    .option('-d, --data <value>', 'Set body parameters (e.g. -d "name=NDA")', (val, prev) => prev.concat([val]), [])
    .addHelpText('afterAll', `\nExamples:\n  $ docuseal ${name} /templates\n  $ docuseal ${name} /templates/1`)
    .action(async (path, opts) => {
      const data = opts.data.length > 0 ? parseDataFlags(opts.data) : undefined

      createClient(opts).http[method.toLowerCase()](path, data).then(renderJson, onError)
    })
}

export function registerRawCommands(program) {
  registerRawCommand(program, 'get', 'GET')
  registerRawCommand(program, 'post', 'POST')
  registerRawCommand(program, 'put', 'PUT')
  registerRawCommand(program, 'delete', 'DELETE')
}
