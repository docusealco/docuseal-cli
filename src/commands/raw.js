import { createClient, onError } from '../lib/api.js'
import { renderJson } from '../lib/output.js'
import { withGlobalOptions, formatExamples } from '../lib/global-options.js'

function parseDataFlags(pairs) {
  const result = {}
  for (const pair of pairs) {
    const eqIdx = pair.indexOf('=')
    if (eqIdx === -1) continue
    result[pair.slice(0, eqIdx)] = pair.slice(eqIdx + 1)
  }
  return result
}

function registerRawCommand(program, name, method, examples) {
  withGlobalOptions(program.command(name))
    .description(`Make a raw ${method} request to the API`)
    .argument('<path>', 'API path (e.g. /templates, /submissions/1)')
    .option('-d, --data <value>', 'Set body parameters (e.g. -d "name=NDA")', (val, prev) => prev.concat([val]), [])
    .addHelpText('afterAll', formatExamples(examples))
    .action(async (path, opts) => {
      const data = opts.data.length > 0 ? parseDataFlags(opts.data) : undefined

      createClient(opts).http[method.toLowerCase()](path, data).then(renderJson, onError)
    })
}

export function registerRawCommands(program) {
  registerRawCommand(program, 'get', 'GET', [
    'docuseal get /templates',
    'docuseal get /submissions/1',
  ])
  registerRawCommand(program, 'post', 'POST', [
    'docuseal post /submissions/init -d "template_id=1" -d "submitters[0][email]=john@acme.com"',
    'docuseal post /templates/1/clone -d "name=NDA Copy"',
  ])
  registerRawCommand(program, 'put', 'PUT', [
    'docuseal put /templates/1 -d "name=NDA v2"',
    'docuseal put /submitters/1 -d "email=new@acme.com"',
  ])
  registerRawCommand(program, 'delete', 'DELETE', [
    'docuseal delete /templates/1',
    'docuseal delete /submissions/1',
  ])
}
