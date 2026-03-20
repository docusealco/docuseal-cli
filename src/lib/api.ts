import { loadConfig, type DocuSealConfig } from './config.ts'
import { handleApiError } from './errors.ts'

type FetchOpts = {
  method?: string
  query?: Record<string, unknown>
  body?: unknown
  configOverrides?: Partial<DocuSealConfig>
}

export async function apiFetch<T = unknown>(path: string, opts: FetchOpts = {}): Promise<T> {
  const config = loadConfig(opts.configOverrides)

  const url = new URL(config.server + path)
  if (opts.query) {
    for (const [key, value] of Object.entries(opts.query)) {
      if (value !== undefined && value !== null && value !== false) {
        url.searchParams.set(key, String(value))
      }
    }
  }

  const res = await fetch(url.toString(), {
    method: opts.method ?? 'GET',
    headers: {
      'X-Auth-Token': config.apiKey,
      'Content-Type': 'application/json',
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })

  if (!res.ok) return handleApiError(res, url.toString())
  return res.json() as Promise<T>
}
