import { Command, Flags, Args } from '@oclif/core'
import { readFileSync } from 'fs'
import { createRequire } from 'module'
import { overrides, type CommandOverride, type CustomFlag } from './ux-overrides.ts'
import { apiFetch } from './lib/api.ts'
import { DocuSealError } from './lib/errors.ts'
import { renderTable, renderJson, renderSuccess, renderError } from './lib/output.ts'

const require = createRequire(import.meta.url)
const spec = require('../openapi-spec.json')

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

  // GET /templates/{id} → get
  if (method === 'GET' && segments.length === 2 && segments[1].startsWith('{')) {
    return { topic, command: 'get' }
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

// ── Auto columns from response data ──────────────────────────────

function autoColumns(row: Record<string, unknown>): string[] {
  if (!row) return ['id']
  return Object.keys(row).filter(k => {
    const v = row[k]
    return v !== null && typeof v !== 'object'
  }).slice(0, 6)
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

// ── Build body params from spec requestBody ──────────────────────

type BodyParam = {
  name: string
  type: string
  required: boolean
  description: string
  enumValues?: string[]
}

// Simple array body params that can be passed as comma-separated strings
const SIMPLE_ARRAY_PARAMS = new Set(['template_ids', 'roles', 'emails'])

function extractBodyParams(operation: any): BodyParam[] {
  const schema = operation.requestBody?.content?.['application/json']?.schema
  if (!schema?.properties) return []

  const required = schema.required || []
  const params: BodyParam[] = []

  for (const [name, prop] of Object.entries(schema.properties) as any[]) {
    // Allow simple array params as comma-separated string flags
    if (prop.type === 'array' && SIMPLE_ARRAY_PARAMS.has(name)) {
      params.push({
        name,
        type: 'string',
        required: required.includes(name),
        description: (prop.description || '') + ' (comma-separated)',
        enumValues: prop.enum,
      })
      continue
    }
    // Skip complex types (arrays, objects) — they need custom flags
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

// ── Build command class ──────────────────────────────────────────

function buildCommandClass(
  method: string,
  path: string,
  operation: any,
  override: CommandOverride | undefined
): typeof Command {
  const { topic, command } = pathToCommandName(method, path)
  const pathParams = extractPathParams(path)
  const queryParams = (operation.parameters || []).filter((p: any) => p.in === 'query')
  const bodyParams = extractBodyParams(operation)

  // Build oclif args for path parameters
  const commandArgs: Record<string, any> = {}
  for (const param of pathParams) {
    commandArgs[param] = Args.string({
      description: `The ${param} of the resource`,
      required: true,
    })
  }

  // Build oclif flags
  const commandFlags: Record<string, any> = {
    'api-key': Flags.string({
      description: 'Override API key for this invocation',
      env: 'DOCUSEAL_API_KEY',
    }),
    server: Flags.string({
      description: 'Server: com, eu, or full URL',
    }),
    json: Flags.boolean({
      char: 'j',
      description: 'Output raw JSON instead of table',
    }),
  }

  // Query params → flags
  for (const param of queryParams) {
    if (pathParams.includes(param.name)) continue
    const flagName = paramToFlagName(param.name)
    const schema = param.schema || {}

    if (schema.type === 'integer') {
      commandFlags[flagName] = Flags.integer({
        description: param.description || '',
        required: param.required || false,
      })
    } else if (schema.type === 'boolean') {
      commandFlags[flagName] = Flags.string({
        description: param.description || '',
        options: ['true', 'false'],
      })
    } else {
      commandFlags[flagName] = Flags.string({
        description: param.description || '',
        required: param.required || false,
      })
    }
  }

  // Body params → flags (simple types only)
  for (const param of bodyParams) {
    const flagName = paramToFlagName(param.name)
    if (commandFlags[flagName]) continue // don't override existing query param flags

    if (param.type === 'integer') {
      commandFlags[flagName] = Flags.integer({
        description: param.description || '',
        required: param.required || false,
      })
    } else if (param.type === 'boolean') {
      commandFlags[flagName] = Flags.string({
        description: param.description || '',
        options: ['true', 'false'],
      })
    } else {
      commandFlags[flagName] = Flags.string({
        description: param.description || '',
        required: param.required || false,
      })
    }
  }

  // Custom flags from overrides
  const customFlags = override?.customFlags || {}
  for (const [name, def] of Object.entries(customFlags)) {
    if (def.type === 'repeatable') {
      commandFlags[name] = Flags.string({
        description: def.description + (def.format ? ` (${def.format})` : ''),
        required: def.required || false,
        multiple: true,
      })
    } else if (def.type === 'boolean') {
      commandFlags[name] = Flags.string({
        description: def.description,
        options: ['true', 'false'],
      })
    } else if (def.type === 'integer') {
      commandFlags[name] = Flags.integer({
        description: def.description,
        required: def.required || false,
      })
    } else {
      commandFlags[name] = Flags.string({
        description: def.description,
        required: def.required || false,
        char: def.char as any,
      })
    }

    // Remove spec-generated flag if custom flag fully replaces the body param
    // e.g. 'submitter' replaces 'submitters', 'file' replaces 'documents'
    // But keep the spec flag if custom flag is an alternative (e.g. html-file alternative to html)
    if (def.mapsTo && (def.mapsTo.includes('[') || def.mapsTo.includes('.'))) {
      const baseParam = def.mapsTo.split('[')[0].split('.')[0]
      const baseFlagName = paramToFlagName(baseParam)
      if (baseFlagName !== name && commandFlags[baseFlagName]) {
        delete commandFlags[baseFlagName]
      }
    }
    // For repeatable custom flags that map to array body params, remove the spec flag
    if (def.mapsTo && def.type === 'repeatable') {
      const baseFlagName = paramToFlagName(def.mapsTo)
      if (baseFlagName !== name && commandFlags[baseFlagName]) {
        delete commandFlags[baseFlagName]
      }
    }
    // If custom flag is an alternative to a spec flag, make the spec flag not required
    if (def.mapsTo && !def.mapsTo.includes('[') && !def.mapsTo.includes('.') && def.type !== 'repeatable') {
      const baseFlagName = paramToFlagName(def.mapsTo)
      if (baseFlagName !== name && commandFlags[baseFlagName]) {
        const existing = commandFlags[baseFlagName]
        commandFlags[baseFlagName] = Flags.string({
          ...existing,
          required: false,
        })
      }
    }
  }

  // Build the Command class
  const commandId = `${topic}:${command}`
  const description = operation.summary || operation.description || ''
  const examples = override?.examples || []

  const CmdClass = class extends Command {
    static id = commandId
    static description = description
    static examples = examples
    static flags = commandFlags
    static args = commandArgs
    static strict = false

    async run() {
      const { args, flags } = await this.parse(CmdClass)

      const configOverrides: any = {}
      if (flags['api-key']) configOverrides.apiKey = flags['api-key']
      if (flags.server) configOverrides.server = flags.server

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
        const val = flags[flagName]
        if (val !== undefined) {
          if (param.schema?.type === 'boolean') {
            query[param.name] = val === 'true'
          } else {
            query[param.name] = val
          }
        }
      }

      // Build body object
      const body: Record<string, unknown> = {}
      let hasBody = false

      for (const param of bodyParams) {
        const flagName = paramToFlagName(param.name)
        const val = flags[flagName]
        if (val !== undefined) {
          hasBody = true
          if (param.type === 'boolean') {
            body[param.name] = val === 'true'
          } else if (SIMPLE_ARRAY_PARAMS.has(param.name)) {
            // Split comma-separated values into array, convert to numbers if needed
            const parts = String(val).split(',').map(s => s.trim())
            body[param.name] = param.name === 'template_ids'
              ? parts.map(Number)
              : parts
          } else {
            body[param.name] = val
          }
        }
      }

      // Handle custom flags
      for (const [name, def] of Object.entries(customFlags)) {
        const val = flags[name]
        if (val === undefined) continue

        if (def.mapsTo === 'submitters' && def.type === 'repeatable') {
          hasBody = true
          const values = Array.isArray(val) ? val : [val]
          body.submitters = values.map((v: string) => def.parse ? def.parse(v) : v)
        } else if (def.mapsTo === 'html' && name === 'html-file') {
          hasBody = true
          const content = readFileSync(val as string, 'utf8')
          body.html = content
        } else if (def.mapsTo?.includes('[0].file')) {
          hasBody = true
          const fileContent = readFileSync(val as string)
          const base64 = Buffer.from(fileContent).toString('base64')
          const fileName = (val as string).split('/').pop() || 'document'
          body.documents = [{ name: fileName, file: `data:application/octet-stream;base64,${base64}` }]
        } else if (def.mapsTo === 'values' && def.type === 'repeatable') {
          hasBody = true
          const values = Array.isArray(val) ? val : [val]
          body.values = values.map((v: string) => def.parse ? def.parse(v) : v)
        } else if (def.mapsTo && !def.mapsTo.startsWith('__')) {
          hasBody = true
          body[def.mapsTo] = val
        }
      }

      try {
        const result = await apiFetch(resolvedPath, {
          method: method.toUpperCase(),
          query: Object.keys(query).length > 0 ? query : undefined,
          body: hasBody ? body : undefined,
          configOverrides: Object.keys(configOverrides).length > 0 ? configOverrides : undefined,
        })

        if (flags.json) {
          renderJson(result)
          return
        }

        if (override?.successMessage) {
          renderSuccess(override.successMessage(result as Record<string, unknown>))
          return
        }

        const data = result as any
        if (data?.data && Array.isArray(data.data)) {
          const columns = override?.tableColumns ?? autoColumns(data.data[0])
          renderTable(data.data, columns)
          return
        }

        if (Array.isArray(data)) {
          const columns = override?.tableColumns ?? autoColumns(data[0])
          renderTable(data, columns)
          return
        }

        renderJson(result)
      } catch (err) {
        if (err instanceof DocuSealError) {
          renderError(`${err.message} (${err.status})`, override?.errorHint)
          process.exit(1)
        }
        throw err
      }
    }
  }

  // oclif needs these as static properties on the class
  Object.defineProperty(CmdClass, 'name', { value: `${topic}_${command}`.replace(/-/g, '_') })

  return CmdClass
}

// ── Register all commands ────────────────────────────────────────

export function registerAllCommands(): Map<string, typeof Command> {
  const commands = new Map<string, typeof Command>()

  for (const [path, methods] of Object.entries(spec.paths) as any[]) {
    for (const [method, operation] of Object.entries(methods) as any[]) {
      if (!operation || typeof operation !== 'object' || !operation.summary) continue

      const key = `${method.toUpperCase()} ${path}`
      const override = overrides[key]

      const CmdClass = buildCommandClass(method.toUpperCase(), path, operation, override)
      const { topic, command } = pathToCommandName(method.toUpperCase(), path)
      const id = `${topic}:${command}`

      commands.set(id, CmdClass)
    }
  }

  return commands
}
