import { DocusealApi, DocusealApiError } from '@docuseal/api'
import { loadConfig } from './config.js'
import { renderJson } from './output.js'

export { DocusealApi, DocusealApiError }

export function createClient(opts = {}) {
  const overrides = {}

  if (opts.apiKey) overrides.apiKey = opts.apiKey
  if (opts.server) overrides.server = opts.server

  const config = loadConfig(Object.keys(overrides).length > 0 ? overrides : undefined)

  return new DocusealApi({ key: config.apiKey, url: config.server })
}

export function onError(err) {
  if (err instanceof DocusealApiError) {
    const match = err.message.match(/^HTTP Error: \d+ - (.*)$/s)

    if (match) {
      try { renderJson(JSON.parse(match[1])) } catch { renderJson({ error: match[1] }) }
    } else {
      renderJson({ error: err.message })
    }

    process.exit(1)
  }

  throw err
}
