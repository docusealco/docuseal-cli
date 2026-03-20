import { Command, Option } from 'commander'
import { readFileSync } from 'fs'
import { createRequire } from 'module'
import { overrides, type CommandOverride, type CustomFlag } from './ux-overrides.ts'
import { apiFetch } from './lib/api.ts'
import { DocuSealError } from './lib/errors.ts'
import { renderJson, renderSuccess } from './lib/output.ts'

const require = createRequire(import.meta.url)
const spec = require('../openapi-spec.json')

// ── Bracket notation parser (-d flag) ───────────────────────────

function parseDataFlags(pairs: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const pair of pairs) {
    const eqIdx = pair.indexOf('=')
    if (eqIdx === -1) continue

    const rawKey = pair.slice(0, eqIdx)
    const value = pair.slice(eqIdx + 1)

    // Parse key into segments: "submitters[0][email]" → ["submitters", "0", "email"]
    const segments: string[] = []
    const firstBracket = rawKey.indexOf('[')
    if (firstBracket === -1) {
      segments.push(rawKey)
    } else {
      segments.push(rawKey.slice(0, firstBracket))
      const rest = rawKey.slice(firstBracket)
      for (const m of rest.matchAll(/\[([^\]]*)\]/g)) {
        segments.push(m[1])
      }
    }

    // Build nested structure
    let current: any = result
    for (let i = 0; i < segments.length - 1; i++) {
      const seg = segments[i]
      const nextSeg = segments[i + 1]
      const nextIsIndex = /^\d+$/.test(nextSeg) || nextSeg === ''

      if (current[seg] === undefined) {
        current[seg] = nextIsIndex ? [] : {}
      }
      current = current[seg]
    }

    const lastSeg = segments[segments.length - 1]
    if (lastSeg === '') {
      // "ids[]=1" → push to array
      if (Array.isArray(current)) {
        current.push(value)
      }
    } else {
      current[lastSeg] = value
    }
  }

  return result
}

function deepMerge(target: Record<string, any>, source: Record<string, any>): Record<string, any> {
  for (const key of Object.keys(source)) {
    if (Array.isArray(source[key]) && Array.isArray(target[key])) {
      // Merge arrays by index
      for (let i = 0; i < source[key].length; i++) {
        if (source[key][i] !== undefined) {
          if (typeof source[key][i] === 'object' && typeof target[key][i] === 'object') {
            target[key][i] = deepMerge(target[key][i], source[key][i])
          } else {
            target[key][i] = source[key][i]
          }
        }
      }
    } else if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key]) &&
               target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) {
      target[key] = deepMerge(target[key], source[key])
    } else {
      target[key] = source[key]
    }
  }
  return target
}

// ── Naming helpers ──────────────────────────────────────────────────

type CommandName = { topic: string; command: string }

// Explicit name overrides for endpoints that don't follow the default naming pattern
const NAME_OVERRIDES: Record<string, CommandName> = {
  'POST /templates/merge': { topic: 'templates', command: 'merge' },
  'POST /submissions/emails': { topic: 'submissions', command: 'send-emails' },
}

function pathToCommandName(method: string, path: string): CommandName {
  const key = `${method} ${path}`
  if (NAME_OVERRIDES[key]) return NAME_OVERRIDES[key]

  const segments = path.split('/').filter(Boolean)
  const topic = segments[0]

  // GET /templates → list
  if (method === 'GET' && !segments.some(s => s.startsWith('{'))) {
    return { topic, command: 'list' }
  }

  // GET /templates/{id} → retrieve
  if (method === 'GET' && segments.length === 2 && segments[1].startsWith('{')) {
    return { topic, command: 'retrieve' }
  }

  // PUT /templates/{id} → update
  if (method === 'PUT' && segments.length === 2 && segments[1].startsWith('{')) {
    return { topic, command: 'update' }
  }

  // DELETE /templates/{id} → archive
  if (method === 'DELETE') {
    return { topic, command: 'archive' }
  }

  // POST /templates → create
  if (method === 'POST' && segments.length === 1) {
    return { topic, command: 'create' }
  }

  // GET /submissions/{id}/documents → documents
  if (method === 'GET' && segments.length === 3 && segments[1].startsWith('{')) {
    return { topic, command: segments[2] }
  }

  // PUT /templates/{id}/documents → update-documents
  if (method === 'PUT' && segments.length === 3 && segments[1].startsWith('{')) {
    return { topic, command: `update-${segments[2]}` }
  }

  // POST /templates/{id}/clone → clone
  if (method === 'POST' && segments.length === 3 && segments[1].startsWith('{')) {
    return { topic, command: segments[2] }
  }

  // POST /templates/pdf → create-pdf
  if (method === 'POST' && segments.length === 2 && !segments[1].startsWith('{')) {
    return { topic, command: `create-${segments[1]}` }
  }

  // fallback
  return { topic, command: segments.slice(1).join('-') }
}

// ── Extract path parameters ──────────────────────────────────────

function extractPathParams(path: string): string[] {
  const matches = path.match(/\{(\w+)\}/g)
  return matches ? matches.map(m => m.slice(1, -1)) : []
}

// ── Convert param name to flag name ──────────────────────────────

function paramToFlagName(name: string): string {
  return name.replace(/_/g, '-')
}

function flagToParamName(name: string): string {
  return name.replace(/-/g, '_')
}

function flagToCamel(name: string): string {
  return name.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
}

// ── Build body params from spec requestBody ──────────────────────

type BodyParam = {
  name: string
  type: string
  required: boolean
  description: string
  enumValues?: string[]
}

function extractBodyParams(operation: any): BodyParam[] {
  const schema = operation.requestBody?.content?.['application/json']?.schema
  if (!schema?.properties) return []

  const required = schema.required || []
  const params: BodyParam[] = []

  for (const [name, prop] of Object.entries(schema.properties) as any[]) {
    // Skip complex types (arrays, objects) — use -d flag for these
    if (prop.type === 'array' || prop.type === 'object') continue
    params.push({
      name,
      type: prop.type || 'string',
      required: required.includes(name),
      description: prop.description || '',
      enumValues: prop.enum,
    })
  }

  return params
}

// ── Register a single command ────────────────────────────────────

function registerCommand(
  program: Command,
  method: string,
  path: string,
  operation: any,
  override: CommandOverride | undefined
): void {
  const { topic, command } = pathToCommandName(method, path)
  const pathParams = extractPathParams(path)
  const queryParams = (operation.parameters || []).filter((p: any) => p.in === 'query')
  const bodyParams = extractBodyParams(operation)
  const customFlags = override?.customFlags || {}
  const description = operation.summary || operation.description || ''

  // Find or create topic subcommand
  let topicCmd = program.commands.find(c => c.name() === topic)
  if (!topicCmd) {
    topicCmd = program.command(topic).description(`Manage ${topic}`)
  }

  // Create the actual command
  const cmd = topicCmd.command(command).description(description)

  // Positional args for path params
  for (const param of pathParams) {
    cmd.argument(`<${param}>`, `The ${param} of the resource`)
  }

  // Collect param names "softened" by custom flags with mapsTo
  const softenedParams = new Set<string>()
  for (const def of Object.values(customFlags)) {
    if (def.mapsTo) {
      const baseParam = def.mapsTo.split('[')[0].split('.')[0]
      softenedParams.add(baseParam)
    }
  }

  // Global flags
  cmd.option('--api-key <value>', 'Override API key for this invocation')
  cmd.option('--server <value>', 'Server: com, eu, or full URL')

  // -d / --data flag (repeatable)
  cmd.option('-d, --data <value>', 'Set body parameters using bracket notation (e.g. -d "submitters[0][email]=john@acme.com")', (val: string, prev: string[]) => prev.concat([val]), [] as string[])

  // Query params → flags
  for (const param of queryParams) {
    if (pathParams.includes(param.name)) continue
    const flagName = paramToFlagName(param.name)
    const schema = param.schema || {}

    if (schema.type === 'integer') {
      const SHORT: Record<string, string> = { limit: 'l', after: 'a' }
      const flags = SHORT[flagName] ? `-${SHORT[flagName]}, --${flagName} <value>` : `--${flagName} <value>`
      const opt = new Option(flags, param.description || '').argParser(parseInt)
      if (param.required) opt.makeOptionMandatory()
      cmd.addOption(opt)
    } else if (schema.type === 'boolean') {
      cmd.option(`--${flagName}`, param.description || '')
      cmd.option(`--no-${flagName}`, '')
    } else if (schema.enum) {
      const opt = new Option(`--${flagName} <value>`, param.description || '').choices(schema.enum)
      if (param.required) opt.makeOptionMandatory()
      cmd.addOption(opt)
    } else {
      const opt = new Option(`--${flagName} <value>`, param.description || '')
      if (param.required) opt.makeOptionMandatory()
      cmd.addOption(opt)
    }
  }

  // Body params → flags (simple types only)
  const addedFlags = new Set(queryParams.map((p: any) => paramToFlagName(p.name)))
  for (const param of bodyParams) {
    const flagName = paramToFlagName(param.name)
    if (addedFlags.has(flagName)) continue
    addedFlags.add(flagName)

    const isSoftened = softenedParams.has(param.name)

    if (param.type === 'integer') {
      const opt = new Option(`--${flagName} <value>`, param.description || '').argParser(parseInt)
      if (param.required && !isSoftened) opt.makeOptionMandatory()
      cmd.addOption(opt)
    } else if (param.type === 'boolean') {
      cmd.option(`--${flagName}`, param.description || '')
      cmd.option(`--no-${flagName}`, '')
    } else if (param.enumValues) {
      const opt = new Option(`--${flagName} <value>`, param.description || '').choices(param.enumValues)
      if (param.required && !isSoftened) opt.makeOptionMandatory()
      cmd.addOption(opt)
    } else {
      const opt = new Option(`--${flagName} <value>`, param.description || '')
      if (param.required && !isSoftened) opt.makeOptionMandatory()
      cmd.addOption(opt)
    }
  }

  // Custom flags from overrides
  for (const [name, def] of Object.entries(customFlags)) {
    if (def.type === 'boolean') {
      cmd.option(`--${name}`, def.description)
      cmd.option(`--no-${name}`, '')
    } else if (def.type === 'integer') {
      const opt = new Option(`--${name} <value>`, def.description).argParser(parseInt)
      if (def.required) opt.makeOptionMandatory()
      cmd.addOption(opt)
    } else {
      const opt = new Option(def.char ? `-${def.char}, --${name} <value>` : `--${name} <value>`, def.description)
      if (def.required) opt.makeOptionMandatory()
      cmd.addOption(opt)
    }
  }

  // Examples
  const examples = override?.examples
  if (examples && examples.length > 0) {
    cmd.addHelpText('after', '\nExamples:\n' + examples.map(e => `  $ ${e}`).join('\n'))
  }

  // Allow unknown options (like oclif strict=false)
  cmd.allowUnknownOption()

  // Action handler
  cmd.action(async (...actionArgs: any[]) => {
    // Commander passes (arg1, arg2, ..., opts, cmd)
    const args: Record<string, string> = {}
    for (let i = 0; i < pathParams.length; i++) {
      args[pathParams[i]] = actionArgs[i]
    }
    const opts = actionArgs[pathParams.length]

    const configOverrides: any = {}
    if (opts.apiKey) configOverrides.apiKey = opts.apiKey
    if (opts.server) configOverrides.server = opts.server

    // Interpolate path params
    let resolvedPath = path
    for (const param of pathParams) {
      resolvedPath = resolvedPath.replace(`{${param}}`, args[param])
    }

    // Build query object
    const query: Record<string, unknown> = {}
    for (const param of queryParams) {
      if (pathParams.includes(param.name)) continue
      const flagName = paramToFlagName(param.name)
      const camelName = flagToCamel(flagName)
      const val = opts[camelName]
      if (val !== undefined) {
        query[param.name] = val
      }
    }

    // Build body object
    const body: Record<string, unknown> = {}
    let hasBody = false

    for (const param of bodyParams) {
      const flagName = paramToFlagName(param.name)
      const camelName = flagToCamel(flagName)
      const val = opts[camelName]
      if (val !== undefined) {
        hasBody = true
        body[param.name] = val
      }
    }

    // Handle custom flags
    for (const [name, def] of Object.entries(customFlags)) {
      const camelName = flagToCamel(name)
      const val = opts[camelName]
      if (val === undefined) continue

      if (def.mapsTo === 'html' && name === 'html-file') {
        hasBody = true
        const content = readFileSync(val as string, 'utf8')
        body.html = content
      } else if (def.mapsTo?.includes('[0].file')) {
        hasBody = true
        const fileContent = readFileSync(val as string)
        const base64 = Buffer.from(fileContent).toString('base64')
        const fileName = (val as string).split('/').pop() || 'document'
        body.documents = [{ name: fileName, file: `data:application/octet-stream;base64,${base64}` }]
      } else if (def.mapsTo && !def.mapsTo.startsWith('__')) {
        hasBody = true
        body[def.mapsTo] = val
      }
    }

    // Handle -d / --data flags (bracket notation)
    const dataFlags = opts.data as string[] | undefined
    if (dataFlags && dataFlags.length > 0) {
      hasBody = true
      const parsed = parseDataFlags(dataFlags)
      deepMerge(body as Record<string, any>, parsed)
    }

    try {
      const result = await apiFetch(resolvedPath, {
        method: method.toUpperCase(),
        query: Object.keys(query).length > 0 ? query : undefined,
        body: hasBody ? body : undefined,
        configOverrides: Object.keys(configOverrides).length > 0 ? configOverrides : undefined,
      })

      if (override?.successMessage) {
        renderSuccess(override.successMessage(result as Record<string, unknown>))
        return
      }

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

// ── Register all commands ────────────────────────────────────────

export function registerAllCommands(program: Command): void {
  for (const [path, methods] of Object.entries(spec.paths) as any[]) {
    for (const [method, operation] of Object.entries(methods) as any[]) {
      if (!operation || typeof operation !== 'object' || !operation.summary) continue

      const key = `${method.toUpperCase()} ${path}`
      const override = overrides[key]

      registerCommand(program, method.toUpperCase(), path, operation, override)
    }
  }
}
