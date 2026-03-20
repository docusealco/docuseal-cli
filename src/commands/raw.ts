import { type Command } from 'commander'
import { apiFetch } from '../lib/api.ts'
import { DocuSealError } from '../lib/errors.ts'
import { renderJson } from '../lib/output.ts'

function parseDataFlags(pairs: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const pair of pairs) {
    const eqIdx = pair.indexOf('=')
    if (eqIdx === -1) continue
    result[pair.slice(0, eqIdx)] = pair.slice(eqIdx + 1)
  }
  return result
}

function registerRawCommand(program: Command, name: string, method: string): void {
  program
    .command(name)
    .description(`Make a raw ${method} request to the API`)
    .argument('<path>', 'API path (e.g. /templates, /submissions/1)')
    .option('--api-key <value>', 'Override API key for this invocation')
    .option('--server <value>', 'Server: com, eu, or full URL')
    .option('-d, --data <value>', 'Set body parameters (e.g. -d "name=NDA")', (val: string, prev: string[]) => prev.concat([val]), [] as string[])
    .addHelpText('after', `\nExamples:\n  $ docuseal ${name} /templates\n  $ docuseal ${name} /templates/1`)
    .action(async (path, opts) => {
      const configOverrides: any = {}
      if (opts.apiKey) configOverrides.apiKey = opts.apiKey
      if (opts.server) configOverrides.server = opts.server

      const dataFlags = opts.data as string[]
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

export function registerRawCommands(program: Command): void {
  registerRawCommand(program, 'get', 'GET')
  registerRawCommand(program, 'post', 'POST')
  registerRawCommand(program, 'put', 'PUT')
  registerRawCommand(program, 'delete', 'DELETE')
}
